import { Context, Data, Effect, Layer, SynchronizedRef } from "effect";
import { FileSystem } from "@effect/platform";
import { BunFileSystem } from "@effect/platform-bun";

export type NixTimerState = {
  currentTimerStartTime: number | undefined;
  totalTime: number;
};

export type INixTimer = Readonly<{
  isRunning: () => Effect.Effect<boolean>;
  start: () => Effect.Effect<void, TimerAlreadyRunningError>;
  stop: () => Effect.Effect<void, TimerNotRunningError>;
  getTotalTime: () => Effect.Effect<number>;
  getCurrentTimerStartTime: () => Effect.Effect<number | undefined>;
}>;

class TimerAlreadyRunningError extends Data.TaggedError(
  "TimerAlreadyRunningError",
) {}

class TimerNotRunningError extends Data.TaggedError("TimerNotRunningError") {}

const make = Effect.gen(function* (_) {
  yield* Effect.logInfo(`Starting NixTimer`);

  const fs = yield* FileSystem.FileSystem;

  const stateRef = yield* Effect.acquireRelease(
    Effect.gen(function* (_) {
      const persistedQueue = yield* fs
        .readFileString("src/nix-timer/persistence.json")
        .pipe(
          Effect.andThen((json) =>
            Effect.try({
              try: (): NixTimerState => JSON.parse(json),
              catch: (): NixTimerState => {
                return {
                  totalTime: 0,
                  currentTimerStartTime: undefined,
                };
              },
            }),
          ),
        );

      const stateRef =
        yield* SynchronizedRef.make<NixTimerState>(persistedQueue);

      yield* Effect.logInfo("NixTimer started");

      return stateRef;
    }),
    (stateRef) => {
      return Effect.gen(function* () {
        const queue = yield* SynchronizedRef.get(stateRef);

        yield* fs
          .writeFileString(
            "src/nix-timer/persistence.json",
            JSON.stringify(queue, null, 2),
          )
          .pipe(
            Effect.tapError(Effect.logError),
            Effect.catchAll((_) => Effect.void),
          );

        yield* Effect.logInfo("NixTimer stopped");
      });
    },
  );

  const isRunning = () =>
    Effect.gen(function* () {
      const state = yield* SynchronizedRef.get(stateRef);

      return state.currentTimerStartTime !== undefined;
    });

  const getTotalTime = () =>
    Effect.gen(function* () {
      const state = yield* SynchronizedRef.get(stateRef);

      return state.totalTime;
    });

  const getCurrentTimerStartTime = () =>
    Effect.gen(function* () {
      const state = yield* SynchronizedRef.get(stateRef);

      return state.currentTimerStartTime;
    });

  const start = () =>
    SynchronizedRef.updateEffect(stateRef, (state) => {
      const isRunning = state.currentTimerStartTime !== undefined;
      if (isRunning) {
        return Effect.fail(new TimerAlreadyRunningError());
      }

      state.currentTimerStartTime = Date.now();

      return Effect.succeed(state);
    });

  const stop = () =>
    SynchronizedRef.updateEffect(stateRef, (state) => {
      if (state.currentTimerStartTime === undefined) {
        return Effect.fail(new TimerNotRunningError());
      }

      const now = Date.now();
      const elapsedTime = now - state.currentTimerStartTime;

      state.totalTime += elapsedTime;

      return Effect.succeed(state);
    });

  return {
    isRunning,
    getTotalTime,
    getCurrentTimerStartTime,
    start,
    stop,
  } as const satisfies INixTimer;
});

export class NixTimerClient extends Context.Tag("nix-timer-client")<
  NixTimerClient,
  INixTimer
>() {
  static Live = Layer.scoped(this, make).pipe(
    Layer.provide(BunFileSystem.layer),
  );
}
