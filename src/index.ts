import { Effect, Deferred, Layer, Console } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { Browser } from "./browser";
import { RedirectServer, program } from "./redirect-server-service";
import { SpotifyConfigService } from "./spotify-config-service";
import { TwitchChatClient, TwitchService } from "./twitch-service";
import { SpotifyApiClient } from "./spotify-service";

const BunTime = {
  funTime: BunRuntime.runMain,
};

// Effect.gen(function* () {
//   const twitchService = yield* TwitchService;
//   yield* twitchService.sendMessage("Hello Chat from EffectTS!");
//
//   return yield* Effect.never;
// }).pipe(Effect.provide(TwitchService.Live), BunTime.funTime);
//
// Effect.gen(function* () {
//   const spotifyClient = yield* SpotifyApiClient;
//
//   yield* Effect.tryPromise(async () => {
//     const profile = await spotifyClient.currentUser.profile();
//
//     console.log({ profile });
//   });
// }).pipe(Effect.provide(SpotifyApiClient.Live), Effect.runPromise);
//
//

BunTime.funTime(program);
