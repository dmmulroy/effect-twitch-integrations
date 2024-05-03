import { EventSubWsListener } from "@twurple/eventsub-ws";
import { Context, Effect, Layer } from "effect";
import { TwitchApiClient } from "./twitch-api";

export class TwitchEventSubClient extends Context.Tag("twitch-eventsub-client")<
  TwitchEventSubClient,
  EventSubWsListener
>() {
  static Live = Layer.scoped(this, make()).pipe(
    Layer.provide(TwitchApiClient.Live),
  );

  static Test = Layer.scoped(this, makeTest()).pipe(
    Layer.provide(TwitchApiClient.Live),
  );
}

function make() {
  return Effect.gen(function* (_) {
    const api = yield* TwitchApiClient;

    const eventsub = yield* Effect.acquireRelease(
      Effect.sync(() => new EventSubWsListener({ apiClient: api.client })),
      (eventsub) =>
        Effect.gen(function* () {
          yield* Effect.logInfo("event sub stopping");
          eventsub.stop();
        }),
    );
    yield* Effect.logInfo("event sub starting");

    return eventsub;
  });
}

function makeTest() {
  return Effect.gen(function* (_) {
    const api = yield* TwitchApiClient;

    const eventsub = yield* Effect.acquireRelease(
      Effect.sync(
        () =>
          new EventSubWsListener({
            apiClient: api.client,
            url: "ws://127.0.0.1:8080/ws",
          }),
      ),
      (eventsub) => {
        eventsub.stop();

        return Effect.void.pipe(() => Effect.logInfo("eventsub disconnected"));
      },
    );
    yield* Effect.logInfo("connected");

    return eventsub;
  });
}
