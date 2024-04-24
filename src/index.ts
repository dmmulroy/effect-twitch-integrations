import { Effect, Config, Secret, Console } from "effect";
import { JwtService, JwtServiceLive, type SignInput } from "./jwt";
import { getLibraryPlaylists } from "./get-playlists";

const program = Effect.gen(function* (effect) {
  const jwtService = yield* effect(JwtService);
  const pem = yield* effect(Config.secret("APPLE_PRIVATE_KEY"));
  const tid = yield* effect(Config.secret("APPLE_TEAM_ID"));
  const kid = yield* effect(Config.secret("APPLE_KEY_ID"));

  const now = Date.now() / 1000;
  const sixMonthsFromNow = now + 15777000;

  const jwtInput: SignInput = {
    secret: Secret.value(pem),
    kid: Secret.value(kid),
    iat: now,
    iss: Secret.value(tid),
    exp: sixMonthsFromNow,
  };

  yield* effect(
    jwtService
      .sign(jwtInput)
      .pipe(Effect.flatMap(getLibraryPlaylists))
      .pipe(Effect.tap(Console.log)),
  );
});

const runnable = Effect.provide(program, JwtServiceLive);

Effect.runPromise(runnable);
