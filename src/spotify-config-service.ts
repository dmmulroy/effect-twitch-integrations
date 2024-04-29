import { Config, Context, Effect, Layer, Secret } from "effect";

export type SpotifyConfigServiceDefinition = Readonly<{
  clientId: string;
  clientSecret: Secret.Secret;
  port: number;
  redirectServerPath: string;
}>;

export class SpotifyConfigService extends Context.Tag("spotify-config-service")<
  SpotifyConfigService,
  SpotifyConfigServiceDefinition
>() {
  static live = Layer.effect(
    SpotifyConfigService,
    Effect.gen(function* () {
      const clientId = yield* Config.string("SPOTIFY_CLIENT_ID");
      const clientSecret = yield* Config.secret("SPOTIFY_CLIENT_SECRET");
      const port = yield* Config.number("REDIRECT_SERVER_PORT").pipe(
        Config.withDefault(3939),
      );
      const redirectServerPath = yield* Config.string(
        "REDIRECT_SERVER_PATH",
      ).pipe(Config.withDefault("redirect"));

      return SpotifyConfigService.of({
        clientId,
        clientSecret,
        port,
        redirectServerPath,
      });
    }),
  );
}
