import { EventSubWsListener } from "@twurple/eventsub-ws";
import { Context, Effect, Layer } from "effect";
import { TwitchApiClient } from "./api";
const make = Effect.gen(function* (_) {
  yield* Effect.logInfo("Starting TwitchEventSubClient");

  const api = yield* TwitchApiClient;

  const eventsub = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const eventsub = new EventSubWsListener({ apiClient: api.client });

      eventsub.start();

      return eventsub;
    }).pipe(Effect.tap(Effect.logInfo("TwitchEventSubClient started"))),
    (eventsub) =>
      Effect.sync(() => eventsub.stop()).pipe(
        Effect.tap(Effect.logInfo("TwitchEventSubClient stopped")),
      ),
  );

  return eventsub;
}).pipe(Effect.annotateLogs({ module: "twitch-eventsub-client" }));

const makeTest = Effect.gen(function* (_) {
  yield* Effect.logInfo("Starting TwitchEventSubClient");

  const api = yield* TwitchApiClient;

  const eventsub = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const eventsub = new EventSubWsListener({
        apiClient: api.client,
        url: "ws://127.0.0.1:8080/ws",
      });

      eventsub.start();

      return eventsub;
    }).pipe(Effect.tap(Effect.logInfo("TwitchEventSubClient started"))),
    (eventsub) =>
      Effect.sync(() => eventsub.stop).pipe(
        Effect.tap(Effect.logInfo("TwitchEventSubClient stopped")),
      ),
  );

  return eventsub;
}).pipe(Effect.annotateLogs({ module: "twitch-eventsub-client" }));

export class TwitchEventSubClient extends Context.Tag("twitch-eventsub-client")<
  TwitchEventSubClient,
  EventSubWsListener
>() {
  static Live = Layer.scoped(this, make).pipe(
    Layer.provide(TwitchApiClient.Live),
  );

  static Test = Layer.scoped(this, makeTest).pipe(
    Layer.provide(TwitchApiClient.Live),
  );
}
