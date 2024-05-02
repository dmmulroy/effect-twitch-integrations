import { BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import {
  TwitchApiClient,
  TwitchEventSubClient,
  TwitchPubSubClient,
  TwitchService,
} from "./twitch-service";
import { TwitchConfig } from "./twitch-config-service";
import { MessageQueue } from "./message-queue";
import { SpotifyApiClient } from "./spotify-service";

const BunTime = {
  funTime: BunRuntime.runMain,
};

const MainLive = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Live,
  TwitchPubSubClient.Live,
  MessageQueue.Live,
  SpotifyApiClient.Live,
);

const main = Effect.gen(function* () {
  yield* TwitchService;

  return yield* Effect.never;
}).pipe(Effect.provide(MainLive));

export const run = () => BunTime.funTime(main);
