import { Effect, Layer, Queue, SynchronizedRef } from "effect";
import { PubSubClient } from "../client";
import { Message } from "../messages";

const make = Effect.gen(function* () {
  yield* Effect.logInfo(`Starting NixTimerSubscriber`);

  const pubsub = yield* PubSubClient;

  const ToggleNixTimerSubscriber = yield* pubsub.subscribeTo("ToggleNixTimer");

  const startTimeRef = yield* SynchronizedRef.make<undefined | number>(
    undefined,
  );

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        yield* Queue.take(ToggleNixTimerSubscriber);
        const startTime = yield* SynchronizedRef.get(startTimeRef);

        if (startTime !== undefined) {
          const now = Date.now();

          const elapsedTime = now - startTime;

          yield* SynchronizedRef.set(startTimeRef, undefined);

          yield* pubsub.publish(
            Message.SendTwitchChat({
              message: `Nix timer stopped ⏳`,
            }),
          );

          yield* pubsub.publish(
            Message.SendTwitchChat({
              message: `${elapsedTime} milliseconds spent configuring nix ❄️`,
            }),
          );

          return yield* Effect.void;
        }

        const now = Date.now();
        yield* SynchronizedRef.set(startTimeRef, now);

        yield* pubsub.publish(
          Message.SendTwitchChat({
            message: `Nix timer started ⏳`,
          }),
        );
      }).pipe(
        Effect.forever,
        Effect.catchAll(() => Effect.void),
      ),
    ),
  );

  yield* Effect.acquireRelease(
    Effect.logInfo(`NixTimerSubscriber started`),
    () =>
      Effect.gen(function* () {
        yield* SynchronizedRef.set(startTimeRef, undefined);
        yield* Effect.logInfo(`NixTimerSubscriber stopped`);
      }),
  );
}).pipe(
  Effect.annotateLogs({
    module: "nix-timer-subscriber",
  }),
);

export const NixTimerSubscriber = Layer.scopedDiscard(make).pipe(
  Layer.provide(PubSubClient.Live),
);
