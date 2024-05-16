import {
	Context,
	Data,
	Effect,
	Layer,
	PubSub,
	Queue,
	Scope,
	Types,
} from "effect";

export type Message = Data.TaggedEnum<{
	CurrentlyPlaying: {
		song: string;
		artists: ReadonlyArray<string>;
		requesterDisplayName: string;
	};
	CurrentlyPlayingRequest: { requesterDisplayName: string };
	SendTwitchChat: { message: string };
	SongRequest: { requesterDisplayName: string; url: string };
}>;

export type MessageType = Types.Tags<Message>;

type ExtractMessage<T extends MessageType> = Types.ExtractTag<Message, T>;

export type CurrentlyPlayingRequestMessage =
	ExtractMessage<"CurrentlyPlayingRequest">;

export type CurrentlyPlayingMessage = ExtractMessage<"CurrentlyPlaying">;

export type SendTwitchChatMessage = ExtractMessage<"SendTwitchChat">;

export type SongRequestMessage = ExtractMessage<"SongRequest">;

export const Message = Data.taggedEnum<Message>();

type MessageTypeToMessage = {
	CurrentlyPlayingRequest: CurrentlyPlayingRequestMessage;
	CurrentlyPlaying: CurrentlyPlayingMessage;
	SendTwitchChat: SendTwitchChatMessage;
	SongRequest: SongRequestMessage;
};

export type IMessagePubSub = Readonly<{
	publish: (message: Message) => Effect.Effect<boolean>;
	subscribe: () => Effect.Effect<Queue.Dequeue<Message>, never, Scope.Scope>;
	subscribeTo: <T extends MessageType>(
		messageType: T,
	) => Effect.Effect<
		Queue.Dequeue<MessageTypeToMessage[T]>,
		never,
		Scope.Scope
	>;
}>;

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting MessagePubSub");

	const pubsub: PubSub.PubSub<Message> = yield* Effect.acquireRelease(
		PubSub.unbounded<Message>().pipe(
			Effect.tap(Effect.logInfo("MessagePubSub started")),
		),
		(queue) =>
			PubSub.shutdown(queue).pipe(
				Effect.tap(Effect.logInfo("MessagePubSub stopped")),
			),
	);

	return MessagePubSub.of({
		publish: (message) => PubSub.publish(pubsub, message),
		subscribe: () => PubSub.subscribe(pubsub),

		subscribeTo: <T extends MessageType>(messageType: T) =>
			Effect.gen(function* () {
				const queue = yield* Effect.acquireRelease(
					Queue.unbounded<MessageTypeToMessage[T]>(),
					(queue) => Queue.shutdown(queue),
				);

				const subscription = yield* PubSub.subscribe(pubsub);

				function predicate(
					message: Message,
				): message is MessageTypeToMessage[T] {
					return message._tag === messageType;
				}

				yield* Effect.forkScoped(
					Effect.forever(
						Effect.gen(function* () {
							const message = yield* subscription.take;

							if (predicate(message)) {
								yield* Queue.offer(queue, message);
							}
						}),
					).pipe(Effect.catchAll(() => Effect.void)),
				);

				return queue;
			}),
	});
}).pipe(Effect.annotateLogs({ module: "message-pubsub" }));

export class MessagePubSub extends Context.Tag("message-pubsub")<
	MessagePubSub,
	IMessagePubSub
>() {
	static Live = Layer.scoped(this, make);
}
