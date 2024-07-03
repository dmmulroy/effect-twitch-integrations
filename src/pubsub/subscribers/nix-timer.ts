import {
  Chunk,
  Effect,
  Layer,
  Match,
  Queue,
  Stream,
  SynchronizedRef,
} from "effect";
import { PubSubClient } from "../client";
import { Message } from "../messages";

const make = Effect.gen(function* () {
  yield* Effect.logInfo(`Starting NixTimerSubscriber`);

  const pubsub = yield* PubSubClient;

  const startNixTimerSubscriber = yield* pubsub.subscribeTo("StartNixTimer");
  const stopNixTimerSubscriber = yield* pubsub.subscribeTo("StopNixTimer");

  const startTimeRef = yield* SynchronizedRef.make<undefined | number>(
    undefined,
  );

  const stream = Stream.merge(
    Stream.fromQueue(startNixTimerSubscriber),
    Stream.fromQueue(stopNixTimerSubscriber),
  );

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        const message = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.andThen(Chunk.unsafeGet(1)),
        );

        Match.type<typeof message>().pipe(
          Match.tag("StartNixTimer", () =>
            Effect.gen(function* () {
              if (SynchronizedRef.get(startTimeRef) === undefined) {
                yield* pubsub.publish(
                  Message.SendTwitchChat({
                    message: `Nix timer is already running ⏳`,
                  }),
                );
              }

              const now = Date.now();
              yield* SynchronizedRef.set(startTimeRef, now);

              yield* pubsub.publish(
                Message.SendTwitchChat({
                  message: `Nix timer started ⏳`,
                }),
              );
            }),
          ),
          Match.tag("StopNixTimer", () =>
            Effect.gen(function* (_) {
              if (SynchronizedRef.get(startTimeRef) === undefined) {
                yield* pubsub.publish(
                  Message.SendTwitchChat({
                    message: `Nix timer is not running ⏳`,
                  }),
                );
              }

              const now = Date.now();
              const startTime = yield* SynchronizedRef.get(startTimeRef);

              if (startTime === undefined) {
                return yield* Effect.dieMessage("startTime got in a bad state");
              }

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
            }),
          ),
          Match.exhaustive,
        )(message);
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
