import { Effect, Layer, Queue } from "effect";
import { PubSubClient } from "../client";
import { Message } from "../messages";
import { NixTimerClient } from "../../nix-timer/client";

const make = Effect.gen(function* () {
  yield* Effect.logInfo(`Starting NixTimerSubscriber`);

  const pubsub = yield* PubSubClient;
  const timer = yield* NixTimerClient;

  const ToggleNixTimerSubscriber = yield* pubsub.subscribeTo("ToggleNixTimer");

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        yield* Queue.take(ToggleNixTimerSubscriber);

        if (timer.isRunning()) {
          const now = Date.now();
          const startTime = (yield* timer.getCurrentTimerStartTime()) ?? 0;
          const elapsedTime = now - startTime;

          yield* timer.stop();

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

        yield* timer.start();

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
