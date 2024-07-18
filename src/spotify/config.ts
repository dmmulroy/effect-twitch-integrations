import { Config } from "effect";
import AccessTokenJson from "../do_not_open_on_stream/access-token.json";
import type { AccessToken } from "@spotify/web-api-ts-sdk";

// TODO Schema decode
const accessToken: AccessToken = AccessTokenJson as unknown as AccessToken;

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

export const SpotifyConfig = Config.all({
  accessToken: Config.succeed(accessToken),
  clientId: Config.string("SPOTIFY_CLIENT_ID"),
  clientSecret: Config.secret("SPOTIFY_CLIENT_SECRET"),
  port: Config.number("REDIRECT_SERVER_PORT").pipe(Config.withDefault(3939)),
  scopes: Config.succeed(scopes),
  redirectServerPath: Config.string("REDIRECT_SERVER_PATH").pipe(
    Config.withDefault("redirect"),
  ),
});
