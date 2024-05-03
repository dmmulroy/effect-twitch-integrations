import { Context, Layer, Effect, Secret, Queue, pipe } from "effect";
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
    }),
  ).pipe(Layer.provide(TwitchConfig.Live));

  static StaticAuthProviderLive = Layer.effect(
    this,
    Effect.map(TwitchConfig, (config) => {
      const authProvider = new StaticAuthProvider(
        config.clientId,
        Secret.value(config.accessToken),
        config.scopes,
      );

      return authProvider;
    }),
  ).pipe(Layer.provide(TwitchConfig.Live));
}

export class TwitchApiClient extends Context.Tag("twitch-api-client")<
  TwitchApiClient,
  ApiClient
>() {
  static Live = Layer.effect(
    this,
    Effect.map(TwitchAuthProvider, (authProvider) => {
      return new ApiClient({ authProvider });
    }),
  ).pipe(Layer.provide(TwitchAuthProvider.RefreshingAuthProviderLive));
}

export class TwitchEventSubClient extends Context.Tag("twitch-eventsub-client")<
  TwitchEventSubClient,
  EventSubWsListener
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const apiClient = yield* TwitchApiClient;

      const eventsub = yield* Effect.acquireRelease(
        Effect.succeed(new EventSubWsListener({ apiClient })),
        (eventsub) => {
          return Effect.gen(function* () {
            yield* Effect.logInfo("event sub stopping");
            eventsub.stop();

            return Effect.void;
          });
        },
      );
      yield* Effect.logInfo("event sub starting");

      return eventsub;
    }),
  ).pipe(Layer.provide(TwitchApiClient.Live));

  static Test = Layer.scoped(
    this,
    Effect.gen(function* () {
      const apiClient = yield* TwitchApiClient;

      const eventsub = yield* Effect.acquireRelease(
        Effect.succeed(
          new EventSubWsListener({ apiClient, url: "ws://127.0.0.1:8080/ws" }),
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

const TwitchClientsLive = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Live,
);

const TwitchClientsTest = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Test,
);

export const TwitchService = Layer.effectDiscard(
  Effect.scoped(
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

          await Effect.gen(function* () {
            if (event.messageText.startsWith("!")) {
              if (event.messageText === "!song") {
                yield* pubsub.publish(Message.CurrentlyPlayingRequest());
              }
            }
          }).pipe(Effect.runPromise);
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

            yield* Effect.tryPromise(async () => {
              return api.chat.sendChatMessage(
                config.broadcasterId,
                `The currently playing song is ${song.name}`,
              );
            });
          }),
        ),
      );

      return yield* Effect.never;
    }),
  ),
).pipe(Layer.provide(Layer.mergeAll(TwitchClientsLive)));
