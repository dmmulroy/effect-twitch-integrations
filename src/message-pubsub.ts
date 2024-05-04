import type { TrackItem } from "@spotify/web-api-ts-sdk";
import { Context, Data, Effect, Layer, PubSub, Queue, Scope } from "effect";

export type Message = Data.TaggedEnum<{
  CurrentlyPlayingRequest: {};
  CurrentlyPlaying: { song: TrackItem };
  SongRequest: { uri: string };
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
export type MessageType = Message["_tag"];

export const Message = Data.taggedEnum<Message>();

type MessageTypeToMessage = {
  CurrentlyPlayingRequest: CurrentlyPlayingRequestMessage;
  CurrentlyPlaying: CurrentlyPlayingMessage;
  SongRequest: SongRequestMessage;
};

export type IMessagePubSub = Readonly<{
  publish: (message: Message) => Effect.Effect<boolean>;
  subscribe: Effect.Effect<Queue.Dequeue<Message>, never, Scope.Scope>;
  subscribeTo: <T extends MessageType>(
    messageType: T,
  ) => Effect.Effect<
    Queue.Dequeue<MessageTypeToMessage[T]>,
    never,
    Scope.Scope
  >;
}>;

const make = Effect.gen(function* () {
  const pubsub: PubSub.PubSub<Message> = yield* Effect.acquireRelease(
    PubSub.unbounded<Message>(),
    (queue) =>
      Effect.gen(function* () {
        return PubSub.shutdown(queue).pipe(
          Effect.tap(Effect.log("MessagePubSub stopped")),
        );
      }),
  );

  yield* Effect.logInfo("MessagePubSub started");

  return MessagePubSub.of({
    publish: pubsub.publish,
    subscribe: pubsub.subscribe,
    subscribeTo: <T extends MessageType>(messageType: T) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(
          `MessagePubSub recevied subscription for ${messageType}`,
        );
        const queue = yield* Effect.acquireRelease(
          Queue.unbounded<MessageTypeToMessage[T]>(),
          (queue) =>
            Queue.shutdown(queue).pipe(() => Effect.logInfo(`dequque stopped`)),
        );

        yield* Effect.logInfo(`dequque starting for ${messageType}`);
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

              yield* Effect.logInfo(`consumer received ${message}`);

              if (predicate(message)) {
                yield* Queue.offer(queue, message);
              }
            }),
          ),
        );

        yield* Effect.addFinalizer(() =>
          Effect.logInfo(`consumer for ${messageType} ending`),
        );

        return queue;
      }),
  });
});

export class MessagePubSub extends Context.Tag("message-pubsub")<
  MessagePubSub,
  IMessagePubSub
>() {
  static Live = Layer.scoped(this, make);
}
