import { randomBytes } from "crypto";
import { Effect, Config, Secret, Console, Layer, Deferred } from "effect";
import { BunRuntime as BunTime } from "@effect/platform-bun";

import accessToken from "./access-token";
import {
  DefaultRedirectServer,
  RedirectServerService,
} from "./redirect-server";
import { Browser } from "./browser";

Effect.gen(function* () {
  const redirectServerService = yield* RedirectServerService;
  const clientId = yield* Config.string("SPOTIFY_CLIENT_ID");
  const clientSecret = yield* Config.secret("SPOTIFY_CLIENT_SECRET");

  const redirectServer = yield* redirectServerService.make({
    clientId,
    clientSecret: Secret.value(clientSecret),
    port: 3939,
    redirectUri: "/spotify",
  });

  const runningRedirectServer = yield* redirectServer.start();
  const mailbox = runningRedirectServer.mailbox;

  const redirect_uri = "http://localhost:3939/spotify";
  const csrfToken = randomBytes(256).toString("hex");

  const searchParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "user-read-private",
    redirect_uri,
    state: csrfToken,
    show_dialog: "true",
  });

  const authorizeUrl = new URL(
    `https://accounts.spotify.com/authorize?${searchParams.toString()}`,
  );

  yield* Browser.open(authorizeUrl).pipe(
    Effect.match({
      onSuccess: () => console.log("browser opened successfully"),
      onFailure: console.error,
    }),
  );

  const code = yield* Deferred.await(mailbox);

  console.log({ code });
})
  .pipe(Effect.provide(DefaultRedirectServer))
  .pipe(BunTime.runMain);
