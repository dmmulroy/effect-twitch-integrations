import { Context, Layer, Effect, Secret, Queue, Data } from "effect";
import {
  RefreshingAuthProvider,
  StaticAuthProvider,
  type AuthProvider,
} from "@twurple/auth";
import { TwitchConfig } from "./twitch-config";
import { ApiClient } from "@twurple/api";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { Message, MessagePubSub } from "../message-pubsub";

export class TwitchAuthProvider extends Context.Tag("twitch-auth-provider")<
  TwitchAuthProvider,
  AuthProvider
>() {
  static RefreshingAuthProviderLive = Layer.effect(
    this,
    Effect.gen(function* () {
      const config = yield* TwitchConfig;

      const authProvider = new RefreshingAuthProvider({
        clientId: config.clientId,
        clientSecret: Secret.value(config.clientSecret),
        appImpliedScopes: config.scopes,
      });

      return authProvider;
    }),
  ).pipe(Layer.provide(TwitchConfig.Live));

  static StaticAuthProviderLive = Layer.effect(
    this,
    Effect.gen(function* () {
      const config = yield* TwitchConfig;

      const authProvider = new StaticAuthProvider(
        config.clientId,
        Secret.value(config.accessToken),
        config.scopes,
      );

      return authProvider;
    }),
  ).pipe(Layer.provide(TwitchConfig.Live));
}

export class TwitchError extends Data.TaggedError("TwitchError")<{
  cause: unknown;
}> {}

export type ITwitchApiClient = Readonly<{
  client: ApiClient;
  useApi: <A>(
    fn: (client: ApiClient) => Promise<A>,
  ) => Effect.Effect<A, TwitchError, never>;
}>;

function make() {
  return Effect.gen(function* () {
    const authProvider = yield* TwitchAuthProvider;
    const client = new ApiClient({ authProvider });

    const useApi = <A>(f: (client: ApiClient) => Promise<A>) =>
      Effect.tryPromise({
        try: () => f(client),
        catch: (error) => new TwitchError({ cause: error }),
      });

    return { useApi, client } as const;
  });
}

export class TwitchApiClient extends Context.Tag("app/Twitch")<
  TwitchApiClient,
  ITwitchApiClient
>() {
  static Live = Layer.effect(this, make()).pipe(
    Layer.provide(TwitchAuthProvider.RefreshingAuthProviderLive),
  );
}

export class TwitchEventSubClient extends Context.Tag("twitch-eventsub-client")<
  TwitchEventSubClient,
  EventSubWsListener
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const api = yield* TwitchApiClient;

      const eventsub = yield* Effect.acquireRelease(
        Effect.sync(() => new EventSubWsListener({ apiClient: api.client })),
        (eventsub) =>
          Effect.gen(function* () {
            yield* Effect.logInfo("event sub stopping");
            eventsub.stop();
            return Effect.void;
          }),
      );
      yield* Effect.logInfo("event sub starting");

      return eventsub;
    }),
  ).pipe(Layer.provide(TwitchApiClient.Live));

  static Test = Layer.scoped(
    this,
    Effect.gen(function* () {
      const api = yield* TwitchApiClient;

      const eventsub = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new EventSubWsListener({
              apiClient: api.client,
              url: "ws://127.0.0.1:8080/ws",
            }),
        ),
        (eventsub) => {
          eventsub.stop();

          return Effect.void.pipe(() =>
            Effect.logInfo("eventsub disconnected"),
          );
        },
      );
      yield* Effect.logInfo("connected");

      return eventsub;
    }),
  ).pipe(Layer.provide(TwitchApiClient.Live));
}

export const TwitchClientsLive = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Live,
);

export const TwitchClientsTest = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Test,
);

export const TwitchService = Layer.scopedDiscard(
  Effect.gen(function* () {
    yield* Effect.logInfo("twitch service starting");
    const api = yield* TwitchApiClient;
    const config = yield* TwitchConfig;
    const eventsub = yield* TwitchEventSubClient;
    const pubsub = yield* MessagePubSub;

    const dequeue = yield* pubsub.subscribeTo("CurrentlyPlaying");

    eventsub.onChannelBan(config.broadcasterId, async () => {
      await Effect.logInfo("Ban event").pipe(Effect.runPromise);
    });

    eventsub.onChannelChatMessage(
      config.broadcasterId,
      config.broadcasterId,
      async (event) => {
        await Effect.logInfo("chat message").pipe(Effect.runPromise);

        if (event.messageText === "!song") {
          await Effect.runPromise(
            pubsub.publish(Message.CurrentlyPlayingRequest()),
          );
        }
      },
    );

    // eventsub.onChannelRedemptionAddForReward(
    //   config.broadcasterId,
    //   config.songRequestRewardId,
    //   (event) => {
    //     Effect.gen(function* () {
    //       yield* pubsub.publish(Message.SongRequest({ uri: event.input }));
    //     });
    //   },
    // );

    yield* Effect.forkScoped(
      Effect.forever(
        Effect.gen(function* () {
          yield* Effect.logInfo("waiting for song");

          const { song } = yield* Queue.take(dequeue);

          yield* Effect.logInfo("received song");

          yield* api.useApi((client) =>
            client.chat.sendChatMessage(
              config.broadcasterId,
              `The currently playing song is ${song.name}`,
            ),
          );
        }),
      ),
    );
  }),
).pipe(Layer.provide(Layer.mergeAll(TwitchClientsLive)));
