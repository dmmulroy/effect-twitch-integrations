import { Context, Effect, Layer, Queue, Schedule } from "effect";

interface ISongQueue {
  readonly enqueue: (spotifySongUri: string) => Effect.Effect<void, Error>;
}

export class SongQueue extends Context.Tag("song-queue")<
  SongQueue,
  ISongQueue
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const queue = yield* Effect.acquireRelease(
        Queue.unbounded<string>(),
        (queue) => {
          console.log("shutting down queue");
          return Queue.shutdown(queue);
        },
      );

      yield* Effect.forkScoped(
        Effect.forever(
          Effect.gen(function* () {
            console.log("waiting to take");
            const songUriOption = yield* Queue.take(queue);

            console.log(`Proccesed song request: ${songUriOption}`);

            return Effect.void;
          }),
        ),
      );

      return {
        enqueue: (spotifySongUri) => {
          return Effect.gen(function* () {
            const _ = yield* Queue.offer(queue, spotifySongUri);
          });
        },
      };
    }),
  );
}
