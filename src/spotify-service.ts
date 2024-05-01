import { SpotifyApi, type AccessToken } from "@spotify/web-api-ts-sdk";
import { Context, Effect, Layer, Secret } from "effect";
import { SpotifyConfigService } from "./spotify-config-service";

const scopes = [
  // "ugc-image-upload",
  // "user-read-playback-state",
  // "user-modify-playback-state",
  // "user-read-currently-playing",
  // "app-remote-control",
  // "streaming",
  // "playlist-read-private",
  // "playlist-read-collaborative",
  // "playlist-modify-private",
  // "playlist-modify-public",
  // "user-follow-modify",
  // "user-follow-read",
  // "user-read-playback-position",
  // "user-top-read",
  // "user-read-recently-played",
  // "user-library-modify",
  // "user-library-read",
  // "user-read-email",
  "user-read-private",
];

// Choose one of the following:
/* 
const result = await sdk.currentUser.profile();

console.log(JSON.stringify(result, null, 2)); */
export class SpotifyApiClient extends Context.Tag("spotify-api-client")<
  SpotifyApiClient,
  SpotifyApi
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const config = yield* SpotifyConfigService;

      return SpotifyApi.withAccessToken(config.clientId, config.accessToken);
    }),
  ).pipe(Layer.provide(SpotifyConfigService.Live));
}
