import { Deferred, Effect, Layer } from "effect";
import { RedirectServer } from "./redirect-server-service";
import { SpotifyConfig } from "./spotify/spotify-config";
import { Browser } from "./browser";
import { requestAccessToken } from "./spotify/spotify-service";
import { BunRuntime } from "@effect/platform-bun";

const BunTime = {
  funTime: BunRuntime.runMain,
};

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

const MainLive = Layer.merge(SpotifyConfig.Live, RedirectServer.Live);

const getAccessToken = Effect.gen(function* () {
  const config = yield* SpotifyConfig;
  const redirectServer = yield* RedirectServer;

  const mailbox = yield* redirectServer.getMailbox();

  const searchParams = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: scopes.join(" "),
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

  yield* Effect.promise(() =>
    Bun.write(
      "src/do_not_open_on_stream/access-token.json",
      JSON.stringify(accessToken, null, 2),
    ),
  );
}).pipe(Effect.provide(MainLive));

BunTime.funTime(getAccessToken);
