import { Effect, Layer, Queue } from "effect";
import { PubSubClient } from "../client";
import { SpotifyApiClient } from "../../spotify/api";
import { Message } from "../messages";
import { SongQueueClient } from "../../song-queue/client";

const make = Effect.gen(function* (_) {
  yield* Effect.logInfo(`Starting SongQueueRequestSubscriber`);

  const songQueue = yield* SongQueueClient;
  const pubsub = yield* PubSubClient;

  const songRequestSubscriber = yield* pubsub.subscribeTo("SongQueueRequest");

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* (_) {
        yield* Queue.take(songRequestSubscriber);
        const queue = yield* songQueue.getQueue();

        yield* pubsub.publish(Message.SongQueue({ queue }));
      }).pipe(Effect.catchAll(() => Effect.void)),
    ),
  );

  yield* Effect.acquireRelease(
    Effect.logInfo(`SongQueueRequestSubscriber started`),
    () => Effect.logInfo(`SongQueueRequestSubscriber stopped`),
  );
}).pipe(
  Effect.annotateLogs({
    module: "song-queue-request-subscriber",
  }),
);

export const SongQueueRequestSubscriber = Layer.scopedDiscard(make).pipe(
  Layer.provide(PubSubClient.Live),
  Layer.provide(SongQueueClient.Live),
);
