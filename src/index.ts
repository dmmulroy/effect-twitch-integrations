import { Effect, Deferred, Layer, Console } from "effect";
import { BunRuntime as BunTime } from "@effect/platform-bun";

import { Browser } from "./browser";
import { RedirectServer } from "./redirect-server-service";
import { SpotifyConfigService } from "./spotify-config-service";
import { TwitchChatClient, TwitchService } from "./twitch-service";

const MainLive = Layer.merge(SpotifyConfigService.Live, RedirectServer.Live);

/* const _spotifyAuthProgram = Effect.gen(function* () {
  const redirectServer = yield* RedirectServer;
  const config = yield* SpotifyConfigService;

  const mailbox = yield* redirectServer.getMailbox();

  const searchParams = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: "user-read-private",
    redirect_uri: `http://localhost:${config.port}/${config.redirectServerPath}`,
    state: "foo",
    show_dialog: "true",
  });

  const authorizeUrl = new URL(
    `https://accounts.spotify.com/authorize?${searchParams.toString()}`,
  );

  yield* Browser.open(authorizeUrl);
  yield* Deferred.await(mailbox).pipe(Effect.tap(Console.log));

  // run forever
  return yield* Effect.never;
}).pipe(Effect.provide(MainLive), BunTime.runMain); */

Effect.gen(function* () {
  const twitchService = yield* TwitchService;
  return yield* twitchService.sendMessage("Hello Chat from EffectTS!");
}).pipe(Effect.provide(TwitchService.Live), Effect.runPromise);
