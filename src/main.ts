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

const main = Effect.gen(function* () {
  yield* TwitchService;

  return yield* Effect.never;
}).pipe(Effect.provide(TwitchService.Live));

export const run = () => BunTime.funTime(main);
