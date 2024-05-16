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
  CurrentlyPlayingRequest: { requesterDisplayName: string };
  CurrentlyPlaying: {
    song: string;
    artists: ReadonlyArray<string>;
    requesterDisplayName: string;
  };
  InvalidSongRequest: { requesterDisplayName: string; reason: string };
  SongRequest: { requesterDisplayName: string; url: string };
  SongRequestError: { requesterDisplayName: string; cause: unknown };
}>;

export type CurrentlyPlayingRequestMessage = Extract<
  Message,
  { _tag: "CurrentlyPlayingRequest" }
>;

export type CurrentlyPlayingMessage = Extract<
  Message,
  { _tag: "CurrentlyPlaying" }
>;

export type SongRequestMessage = Extract<Message, { _tag: "SongRequest" }>;

export type SongRequestErrorMessage = Extract<
  Message,
  { _tag: "SongRequestError" }
>;

// TODO: Refactor to use Types.ExtractTag
export type InvalidSongRequestMessageVs = Types.ExtractTag<
  Message,
  "InvalidSongRequest"
>;

export type InvalidSongRequestMessage = Extract<
  Message,
  { _tag: "InvalidSongRequestMessage" }
>;

export type MessageType = Message["_tag"];

export const Message = Data.taggedEnum<Message>();

type MessageTypeToMessage = {
  CurrentlyPlayingRequest: CurrentlyPlayingRequestMessage;
  CurrentlyPlaying: CurrentlyPlayingMessage;
  InvalidSongRequest: InvalidSongRequestMessage;
  SongRequest: SongRequestMessage;
  SongRequestError: SongRequestErrorMessage;
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
          ),
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
