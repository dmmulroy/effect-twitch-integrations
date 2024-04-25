import { Effect, Config, Secret, Console, Layer } from "effect";
import { BunRuntime as BunTime } from "@effect/platform-bun";

import accessToken from "./access-token";
import {
  DefaultRedirectServer,
  RedirectServerService,
} from "./redirect-server";

const program = Effect.gen(function* () {
  const redirectServerService = yield* RedirectServerService;
  const clientId = yield* Config.string("SPOTIFY_CLIENT_ID");
  const clientSecret = yield* Config.secret("SPOTIFY_CLIENT_SECRET");

  let redirectServer = yield* redirectServerService.make({
    clientId,
    clientSecret: Secret.value(clientSecret),
    port: 3939,
    redirectUri: "/spotify",
  });

  redirectServer = yield* redirectServer.start();

  yield* Effect.never;
});

const runnable = Effect.provide(program, DefaultRedirectServer);

BunTime.runMain(runnable);
