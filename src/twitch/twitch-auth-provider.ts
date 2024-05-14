import {
  RefreshingAuthProvider,
  StaticAuthProvider,
  type AuthProvider,
} from "@twurple/auth";
import { Context, Effect, Fiber, Layer, Secret } from "effect";
import { TwitchConfig } from "./twitch-config";

const makeRefreshingAuthProvider = Effect.gen(function* () {
  yield* Effect.logInfo("Starting TwitchAuthProvider");

  const config = yield* TwitchConfig;

  const authProvider = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new RefreshingAuthProvider({
          clientId: config.clientId,
          clientSecret: Secret.value(config.clientSecret),
          appImpliedScopes: config.scopes,
        }),
    ).pipe(Effect.tap(Effect.logInfo("TwitchAuthProvider started"))),
    () => Effect.logInfo("Stopping TwitchAuthProvider"),
  );

  return authProvider;
}).pipe(Effect.annotateLogs({ fiber_name: "twitch-refreshing-auth-provider" }));

const makeStaticAuthProvider = Effect.gen(function* () {
  yield* Effect.logInfo("Starting TwitchAuthProvider");

  const config = yield* TwitchConfig;

  const authProvider = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new StaticAuthProvider(
          config.clientId,
          Secret.value(config.accessToken),
          config.scopes,
        ),
    ).pipe(Effect.tap(Effect.logInfo("TwitchAuthProvider started"))),
    () => Effect.logInfo("Stopping TwitchAuthProvider"),
  );

  return authProvider;
}).pipe(Effect.annotateLogs({ fiber_name: "twitch-static-auth-provider" }));

export class TwitchAuthProvider extends Context.Tag("twitch-auth-provider")<
  TwitchAuthProvider,
  AuthProvider
>() {
  static RefreshingAuthProviderLive = Layer.scoped(
    this,
    makeRefreshingAuthProvider,
  ).pipe(Layer.provide(TwitchConfig.Live));

  static StaticAuthProviderLive = Layer.scoped(
    this,
    makeStaticAuthProvider,
  ).pipe(Layer.provide(TwitchConfig.Live));
}
