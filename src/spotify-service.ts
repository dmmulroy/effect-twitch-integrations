import { SpotifyApi, type AccessToken } from "@spotify/web-api-ts-sdk";
import { Context, Effect, Layer, Secret, Encoding } from "effect";
import * as Http from "@effect/platform";
import {
  SpotifyConfigService,
  type ISpotifyConfigService,
} from "./spotify-config-service";

const scopes = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "app-remote-control",
  "streaming",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-playback-position",
  "user-top-read",
  "user-read-recently-played",
  "user-library-modify",
  "user-library-read",
  "user-read-email",
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

export function requestAccessToken(code: string) {
  return Effect.gen(function* () {
    const config = yield* SpotifyConfigService;
    const authorizationHeader = `Basic ${Encoding.encodeBase64(`${config.clientId}:${Secret.value(config.clientSecret)}`)}`;

    // TODO: Refactor to platform HttpClient
    const token: AccessToken = yield* Effect.tryPromise({
      try: () =>
        fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            Authorization: authorizationHeader,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: encodeFormData({
            code,
            redirect_uri: `http://localhost:${config.port}/${config.redirectServerPath}`,
            grant_type: "authorization_code",
          }),
        }).then((res) => res.json()),
      catch: (error) => {
        console.log("error: ", error);
        return new Error(
          `An error occured while requesting Spotify Access Token: ${error}`,
        );
      },
    });

    return token;
  }).pipe(Effect.provide(SpotifyConfigService.Live));
}

function encodeFormData(data: object) {
  return Object.keys(data)
    .map(
      // @ts-expect-error
      (key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]),
    )
    .join("&");
}
