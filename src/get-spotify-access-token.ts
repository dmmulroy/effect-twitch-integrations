import { Deferred, Effect, Layer } from "effect";
import { RedirectServer } from "./redirect-server-service";
import { SpotifyConfig } from "./spotify/config";
import { Browser } from "./browser";
import { BunRuntime } from "@effect/platform-bun";
import { requestAccessToken } from "./spotify/api";

const BunTime = {
	funTime: BunRuntime.runMain,
};

const getAccessToken = Effect.gen(function* () {
	const config = yield* SpotifyConfig;
	const redirectServer = yield* RedirectServer;

	const mailbox = yield* redirectServer.getMailbox();

	const searchParams = new URLSearchParams({
		response_type: "code",
		client_id: config.clientId,
		scope: config.scopes.join(" "),
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
}).pipe(Effect.provide(RedirectServer.Live));

BunTime.funTime(getAccessToken);
