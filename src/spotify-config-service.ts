import { Config, Context, Effect, Layer, Secret } from "effect";
import AccessToken from "./do_not_open_on_stream/accessToken";
import type { AccessToken as AccessTokenType } from "@spotify/web-api-ts-sdk";

export type SpotifyConfigServiceDefinition = Readonly<{
  accessToken: AccessTokenType;
  clientId: string;
  clientSecret: Secret.Secret;
  port: number;
  redirectServerPath: string;
}>;

export class SpotifyConfigService extends Context.Tag("spotify-config-service")<
  SpotifyConfigService,
  SpotifyConfigServiceDefinition
>() {
  static Live = Layer.effect(
    SpotifyConfigService,
    Effect.gen(function* () {
      // const accessToken = yield* Config.secret("SPOTIFY_ACCESS_TOKEN");
      const clientId = yield* Config.string("SPOTIFY_CLIENT_ID");
      const clientSecret = yield* Config.secret("SPOTIFY_CLIENT_SECRET");
      const port = yield* Config.number("REDIRECT_SERVER_PORT").pipe(
        Config.withDefault(3939),
      );
      const redirectServerPath = yield* Config.string(
        "REDIRECT_SERVER_PATH",
      ).pipe(Config.withDefault("redirect"));

      return {
        accessToken: AccessToken,
        clientId,
        clientSecret,
        port,
        redirectServerPath,
      };
    }),
  );
}
