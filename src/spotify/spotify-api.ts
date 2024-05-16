import {
	AccessTokenHelpers,
	ProvidedAccessTokenStrategy,
	SpotifyApi,
	type AccessToken,
} from "@spotify/web-api-ts-sdk";
import { Context, Effect, Encoding, Layer, Secret } from "effect";
import { SpotifyError } from "./spotify-error";
import { SpotifyConfig } from "./spotify-config";

export type ISpotifyApiClient = Readonly<{
	client: SpotifyApi;
	use: <A>(
		fn: (client: SpotifyApi) => Promise<A>,
	) => Effect.Effect<A, SpotifyError, never>;
}>;

const make = Effect.gen(function* () {
	const config = yield* SpotifyConfig;

	const client = yield* Effect.sync(() => {
		const client = SpotifyApi.withAccessToken(
			config.clientId,
			Secret.value(config.clientSecret),
			config.accessToken,
		);

		client.switchAuthenticationStrategy(
			new ProvidedAccessTokenStrategy(
				config.clientId,
				Secret.value(config.clientSecret),
				config.accessToken,
				async (clientId, clientSecret, accessToken) => {
					const refreshedToken =
						await AccessTokenHelpers.refreshCachedAccessToken(
							clientId,
							clientSecret,
							accessToken,
						);

					const newAccessToken = { ...accessToken, ...refreshedToken };

					await Bun.write(
						"src/do_not_open_on_stream/access-token.json",
						JSON.stringify(newAccessToken, null, 2),
					);

					Effect.logInfo("Refreshed Spotify AccessToken").pipe(
						Effect.annotateLogs({ module: "@spotify/web-api-ts-sdk" }),
						Effect.runSync,
					);

					return newAccessToken;
				},
			),
		);

		return client;
	});

	const use = <A>(fn: (client: SpotifyApi) => Promise<A>) =>
		Effect.tryPromise({
			try: () => fn(client),
			catch: (cause) => new SpotifyError({ cause: String(cause) }),
		});

	return { use, client } as const;
}).pipe(Effect.annotateLogs({ service: "spotify-api-client" }));

export class SpotifyApiClient extends Context.Tag("spotify-api-client")<
	SpotifyApiClient,
	ISpotifyApiClient
>() {
	static Live = Layer.effect(this, make);
}

export function requestAccessToken(code: string) {
	return Effect.gen(function* () {
		const config = yield* SpotifyConfig;
		const authorizationHeader = `Basic ${Encoding.encodeBase64(
			`${config.clientId}:${Secret.value(config.clientSecret)}`,
		)}`;

		// TODO: Refactor to platform HttpClient
		const token: AccessToken = yield* Effect.tryPromise({
			try: () =>
				fetch("https://accounts.spotify.com/api/token", {
					method: "POST",
					headers: {
						Authorization: authorizationHeader,
						"content-type": "application/x-www-form-urlencoded",
					},
					body: encodeFormData({
						code,
						redirect_uri: `http://localhost:${config.port}/${config.redirectServerPath}`,
						grant_type: "authorization_code",
					}),
				}).then((res) => res.json()),
			catch: (error) => {
				return new Error(
					`An error occured while requesting Spotify Access Token: ${error}`,
				);
			},
		});

		return token;
	});
}

function encodeFormData(data: object) {
	return Object.keys(data)
		.map(
			// @ts-expect-error
			(key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]),
		)
		.join("&");
}
