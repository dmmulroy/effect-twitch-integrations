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

const make = Effect.gen(function* () {
  yield* Effect.logInfo(`Starting NixTimer`);

  const fs = yield* FileSystem.FileSystem;
  const volumeMountExists = yield* fs.exists(
    "/data/nix_timer/persistence.json",
  );

  const path = volumeMountExists
    ? "/data/nix_timer/persistence.json"
    : "src/nix-timer/persistence.json";

  yield* Effect.logInfo(`Using path "${path}" for persistence`);

  const stateRef = yield* Effect.acquireRelease(
    Effect.gen(function* () {
      const persistedQueue = yield* fs.readFileString(path).pipe(
        Effect.andThen((json) => Effect.try(() => JSON.parse(json))),
        Effect.orElse(() =>
          Effect.succeed({ totalTime: 0, currentTimerStartTime: undefined }),
        ),
      );

      const stateRef =
        yield* SynchronizedRef.make<NixTimerState>(persistedQueue);

      yield* Effect.logInfo("NixTimer started");

      return stateRef;
    }),
    (stateRef) => {
      return Effect.gen(function* () {
        const state = yield* SynchronizedRef.get(stateRef);

        yield* fs.writeFileString(path, JSON.stringify(state, null, 2)).pipe(
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
      return Effect.gen(function* () {
        yield* Effect.log("Starting NixTimer");
        const isRunning = state.currentTimerStartTime !== undefined;

        if (isRunning) {
          return yield* new TimerAlreadyRunningError();
        }

        state.currentTimerStartTime = Date.now();

        return state;
      });
    });

  const stop = () =>
    SynchronizedRef.updateEffect(stateRef, (state) => {
      return Effect.gen(function* () {
        yield* Effect.log("Stopping NixTimer");
        if (state.currentTimerStartTime === undefined) {
          return yield* new TimerNotRunningError();
        }

        const now = Date.now();
        const elapsedTime = now - state.currentTimerStartTime;

        state.totalTime += elapsedTime;
        state.currentTimerStartTime = undefined;

        yield* fs.writeFileString(path, JSON.stringify(state, null, 2)).pipe(
          Effect.tapError(Effect.logError),
          Effect.catchAll((_) => Effect.void),
        );

        return state;
      });
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
