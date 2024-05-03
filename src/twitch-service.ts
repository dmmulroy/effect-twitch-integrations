import {
  Context,
  Layer,
  Effect,
  Secret,
  Queue,
  pipe,
  Data,
  PubSub,
} from "effect";
import {
  RefreshingAuthProvider,
  StaticAuthProvider,
  type AuthProvider,
} from "@twurple/auth";
import { TwitchConfig, type ITwitchConfig } from "./twitch-config-service";
import { ApiClient } from "@twurple/api";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { Message, MessagePubSub } from "./message-pubsub";

export class TwitchAuthProvider extends Context.Tag("twitch-auth-provider")<
  TwitchAuthProvider,
  AuthProvider
>() {
  static RefreshingAuthProviderLive = Layer.effect(
    this,
    Effect.map(TwitchConfig, (config) => {
      const authProvider = new RefreshingAuthProvider({
        clientId: config.clientId,
        clientSecret: Secret.value(config.clientSecret),
        appImpliedScopes: config.scopes,
      });

      return authProvider;
    })
  ).pipe(Layer.provide(TwitchConfig.Live));

  static StaticAuthProviderLive = Layer.effect(
    this,
    Effect.map(TwitchConfig, (config) => {
      const authProvider = new StaticAuthProvider(
        config.clientId,
        Secret.value(config.accessToken),
        config.scopes
      );

      return authProvider;
    })
  ).pipe(Layer.provide(TwitchConfig.Live));
}

export class TwitchError extends Data.TaggedError("TwitchError")<{
  cause: unknown;
}> {}

const makeApiClient = Effect.gen(function* () {
  const authProvider = yield* TwitchAuthProvider;
  const client = new ApiClient({ authProvider });
  const use = <A>(f: (client: ApiClient) => Promise<A>) =>
    Effect.tryPromise({
      try: () => f(client),
      catch: (error) => new TwitchError({ cause: error }),
    });
  return { use, client } as const;
});

export class Twitch extends Context.Tag("app/Twitch")<
  Twitch,
  Effect.Effect.Success<typeof makeApiClient>
>() {
  static Live = Layer.effect(this, makeApiClient).pipe(
    Layer.provide(TwitchAuthProvider.RefreshingAuthProviderLive)
  );
}

export class TwitchEventSubClient extends Context.Tag("twitch-eventsub-client")<
  TwitchEventSubClient,
  EventSubWsListener
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const api = yield* Twitch;

      const eventsub = yield* Effect.acquireRelease(
        Effect.sync(() => new EventSubWsListener({ apiClient: api.client })),
        (eventsub) =>
          Effect.gen(function* () {
            yield* Effect.logInfo("event sub stopping");
            eventsub.stop();
            return Effect.void;
          })
      );
      yield* Effect.logInfo("event sub starting");

      return eventsub;
    })
  ).pipe(Layer.provide(Twitch.Live));

  static Test = Layer.scoped(
    this,
    Effect.gen(function* () {
      const api = yield* Twitch;

      const eventsub = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new EventSubWsListener({
              apiClient: api.client,
              url: "ws://127.0.0.1:8080/ws",
            })
        ),
        (eventsub) => {
          eventsub.stop();

          return Effect.void.pipe(() =>
            Effect.logInfo("eventsub disconnected")
          );
        }
      );
      yield* Effect.logInfo("connected");

      return eventsub;
    })
  ).pipe(Layer.provide(Twitch.Live));
}

const TwitchClientsLive = Layer.mergeAll(
  TwitchConfig.Live,
  Twitch.Live,
  TwitchEventSubClient.Live
);

const TwitchClientsTest = Layer.mergeAll(
  TwitchConfig.Live,
  Twitch.Live,
  TwitchEventSubClient.Test
);

export const TwitchService = Layer.scopedDiscard(
  Effect.gen(function* () {
    yield* Effect.logInfo("twitch service starting");
    const api = yield* Twitch;
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
            pubsub.publish(Message.CurrentlyPlayingRequest())
          );
        }
      }
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

    yield* Effect.gen(function* () {
      yield* Effect.logInfo("waiting for song");
      const { song } = yield* Queue.take(dequeue);
      yield* Effect.logInfo("received song");
      yield* api.use((_) =>
        _.chat.sendChatMessage(
          config.broadcasterId,
          `The currently playing song is ${song.name}`
        )
      );
    }).pipe(Effect.forever, Effect.forkScoped);
  })
).pipe(Layer.provide(Layer.mergeAll(TwitchClientsLive)));
