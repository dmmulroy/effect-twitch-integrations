import {
  RefreshingAuthProvider,
  StaticAuthProvider,
  type AuthProvider,
} from "@twurple/auth";
import { Context, Effect, Layer, Secret } from "effect";
import { TwitchConfig } from "./twitch-config";

const makeRefreshingAuthProvider = Effect.gen(function* () {
  const config = yield* TwitchConfig;

  const authProvider = new RefreshingAuthProvider({
    clientId: config.clientId,
    clientSecret: Secret.value(config.clientSecret),
    appImpliedScopes: config.scopes,
  });

  return authProvider;
});

const makeStaticAuthProvider = Effect.gen(function* () {
  const config = yield* TwitchConfig;

  const authProvider = new StaticAuthProvider(
    config.clientId,
    Secret.value(config.accessToken),
    config.scopes,
  );

  return authProvider;
});

export class TwitchAuthProvider extends Context.Tag("twitch-auth-provider")<
  TwitchAuthProvider,
  AuthProvider
>() {
  static RefreshingAuthProviderLive = Layer.effect(
    this,
    makeRefreshingAuthProvider,
  ).pipe(Layer.provide(TwitchConfig.Live));

  static StaticAuthProviderLive = Layer.effect(
    this,
    makeStaticAuthProvider,
  ).pipe(Layer.provide(TwitchConfig.Live));
}
