import { ApiClient } from "@twurple/api";
import { Context, Effect, Layer } from "effect";
import { TwitchError } from "./twitch-error";
import { TwitchAuthProvider } from "./twitch-auth-provider";

export type ITwitchApiClient = Readonly<{
  client: ApiClient;
  use: <A>(
    fn: (client: ApiClient) => Promise<A>,
  ) => Effect.Effect<A, TwitchError, never>;
}>;

const make = Effect.gen(function* () {
  const authProvider = yield* TwitchAuthProvider;
  const client = new ApiClient({ authProvider });

  const use = <A>(f: (client: ApiClient) => Promise<A>) =>
    Effect.tryPromise({
      try: () => f(client),
      catch: (error) => new TwitchError({ cause: error }),
    });

  return { use, client } as const;
});

export class TwitchApiClient extends Context.Tag("app/Twitch")<
  TwitchApiClient,
  ITwitchApiClient
>() {
  static Live = Layer.effect(this, make).pipe(
    Layer.provide(TwitchAuthProvider.StaticAuthProviderLive),
  );
}
