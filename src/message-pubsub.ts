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
  subscribe: () => Effect.Effect<Queue.Dequeue<Message>, never, Scope.Scope>;
  subscribeTo: <T extends MessageType>(
    messageType: T,
  ) => Effect.Effect<
    Queue.Dequeue<MessageTypeToMessage[T]>,
    never,
    Scope.Scope
  >;
}>;

export class MessagePubSub extends Context.Tag("message-pubsub")<
  MessagePubSub,
  IMessagePubSub
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const pubsub: PubSub.PubSub<Message> = yield* Effect.acquireRelease(
        PubSub.unbounded<Message>(),
        (queue) => {
          return Effect.gen(function* () {
            yield* Effect.log("MessagePubSub stopped");
            return PubSub.shutdown(queue);
          });
        },
      );

      yield* Effect.logInfo("MessagePubSub started");

      return MessagePubSub.of({
        publish: pubsub.publish,
        subscribe: () => pubsub.subscribe,
        subscribeTo: <T extends MessageType>(messageType: T) => {
          return Effect.gen(function* () {
            yield* Effect.logInfo(
              `MessagePubSub recevied subscription for ${messageType}`,
            );
            const queue: Queue.Queue<MessageTypeToMessage[T]> =
              yield* Effect.acquireRelease(
                Queue.unbounded<MessageTypeToMessage[T]>(),
                (queue) => {
                  return Queue.shutdown(queue).pipe(() =>
                    Effect.logInfo(`dequque stopped`),
                  );
                },
              );

            yield* Effect.logInfo(`dequque starting for ${messageType}`);

            yield* Effect.forkScoped(
              Effect.forever(
                Effect.gen(function* () {
                  yield* Effect.logInfo(`starting consumer for ${messageType}`);
                  const pubsubDequeue = yield* Effect.scoped(
                    PubSub.subscribe(pubsub),
                  );

                  const message = yield* Queue.take(pubsubDequeue);
                  yield* Effect.logInfo(`consumer received ${message}`);

                  function predicate(
                    message: Message,
                  ): message is MessageTypeToMessage[T] {
                    return message._tag === messageType;
                  }

                  if (predicate(message)) {
                    yield* Queue.offer(queue, message);
                  }

                  yield* Effect.logInfo(`consumer for ${messageType} ending`);
                  return yield* Effect.void;
                }),
              ),
            );

            return queue;
          });
        },
      });
    }),
  );
}
