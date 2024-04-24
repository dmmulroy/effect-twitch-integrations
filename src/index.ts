import { Effect, Config, Secret, Console } from "effect";
import { JwtService, JwtServiceLive, type SignInput } from "./jwt";
import { getLibraryPlaylists } from "./get-playlists";

const program = Effect.gen(function* (effect) {
  const jwtService = yield* effect(JwtService);
  const developerToken = yield* effect(Config.secret("APPLE_DEVELOPER_TOKEN"));
  const musicUserToken = yield* effect(Config.secret("APPLE_MUSIC_USER_TOKEN"));
  const secret = yield* effect(Config.secret("APPLE_PRIVATE_KEY"));

  const jwt = yield* effect(
    jwtService.verify(Secret.value(developerToken), Secret.value(secret)),
  );

  yield* effect(
    getLibraryPlaylists(jwt, Secret.value(musicUserToken)).pipe(
      Effect.tap(Console.log),
    ),
  );
});

const runnable = Effect.provide(program, JwtServiceLive);

Effect.runPromise(runnable);
