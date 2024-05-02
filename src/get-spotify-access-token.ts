import { Deferred, Effect, Layer } from "effect";
import { RedirectServer } from "./redirect-server-service";
import { SpotifyConfigService } from "./spotify-config-service";
import { Browser } from "./browser";
import { requestAccessToken } from "./spotify-service";
import { BunRuntime } from "@effect/platform-bun";

const BunTime = {
  funTime: BunRuntime.runMain,
};

// btw, design pill: your "program" can be "Layer.discardEffect(program)" and your main function can be "Layer.launch(fullLayer)" this automatically puts a never so you don't have to
const MainLive = Layer.merge(SpotifyConfigService.Live, RedirectServer.Live);

const getAccessToken = Effect.gen(function* () {
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

  const code = yield* Deferred.await(mailbox);

  const accessToken = yield* requestAccessToken(code);

  yield* Effect.tryPromise(() =>
    Bun.write(
      "src/do_not_open_on_stream/access-token.json",
      JSON.stringify(accessToken, null, 2),
    ),
  );
}).pipe(Effect.provide(MainLive));

BunTime.funTime(getAccessToken);
