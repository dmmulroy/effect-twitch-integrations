import { Effect, Config, Secret, Console } from "effect";
import { JwtService, JwtServiceLive, type SignInput } from "./jwt";
import { getLibraryPlaylists } from "./get-playlists";

const program = Effect.gen(function* (effect) {
  const developerToken = yield* effect(Config.secret("APPLE_DEVELOPER_TOKEN"));
  const musicUserToken = yield* effect(Config.secret("APPLE_MUSIC_USER_TOKEN"));

  yield* effect(
    getLibraryPlaylists(
      Secret.value(developerToken),
      Secret.value(musicUserToken),
    ).pipe(Effect.tap(Console.log)),
  );
});

Effect.runPromise(program);
