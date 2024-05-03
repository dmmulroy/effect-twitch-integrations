import { Effect } from "effect";

// fn (_:R) => Promise<A>
export function use<A, E, R>(
  dependency: R,
  fn: (_: R) => Promise<A>,
): Effect.Effect<A, E, R> {
  return Effect.tryPromise({
    try: () => f(client),
    catch: (error) => new TwitchError({ cause: error }),
  });
}

/* use: <A,E,R>(
    fn: (client: ApiClient) => Promise<A>,
  ) => Effect.Effect<A, TwitchError, never>; */
