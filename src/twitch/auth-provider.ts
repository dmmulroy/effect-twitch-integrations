import {
	RefreshingAuthProvider,
	StaticAuthProvider,
	type AuthProvider,
} from "@twurple/auth";
import { Context, Effect, Layer, Redacted } from "effect";
import { TwitchConfig } from "./config";

const makeRefreshingAuthProvider = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchAuthProvider");

	const config = yield* TwitchConfig;

	const authProvider = yield* Effect.acquireRelease(
		Effect.sync(
			() =>
				new RefreshingAuthProvider({
					clientId: config.clientId,
					clientSecret: Redacted.value(config.clientSecret),
					appImpliedScopes: config.scopes,
				}),
		).pipe(Effect.tap(Effect.logInfo("TwitchAuthProvider started"))),
		() => Effect.logInfo("Stopping TwitchAuthProvider"),
	);

	return authProvider;
}).pipe(Effect.annotateLogs({ module: "twitch-refreshing-auth-provider" }));

const makeStaticAuthProvider = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchAuthProvider");

	const config = yield* TwitchConfig;

	const authProvider = yield* Effect.acquireRelease(
		Effect.sync(
			() =>
				new StaticAuthProvider(
					config.clientId,
					Redacted.value(config.accessToken),
					config.scopes,
				),
		).pipe(Effect.tap(Effect.logInfo("TwitchAuthProvider started"))),
		() => Effect.logInfo("Stopping TwitchAuthProvider"),
	);

	return authProvider;
}).pipe(Effect.annotateLogs({ module: "twitch-static-auth-provider" }));

export class TwitchAuthProvider extends Context.Tag("twitch-auth-provider")<
	TwitchAuthProvider,
	AuthProvider
>() {
	static RefreshingAuthProviderLive = Layer.scoped(
		this,
		makeRefreshingAuthProvider,
	);

	static StaticAuthProviderLive = Layer.scoped(this, makeStaticAuthProvider);
}
