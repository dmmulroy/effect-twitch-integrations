import { Context, Layer, Effect, Secret } from "effect";
import {
  RefreshingAuthProvider,
  StaticAuthProvider,
  type AuthProvider,
} from "@twurple/auth";
import { LogLevel } from "@twurple/chat";
import { PubSubClient } from "@twurple/pubsub";
import { TwitchConfig } from "./twitch-config-service";
import { ApiClient } from "@twurple/api";
import { Message, MessageQueue } from "./message-queue";
import { SpotifyApiClient } from "./spotify-service";
import { EventSubWsListener } from "@twurple/eventsub-ws";

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
  ).pipe(Layer.provide(TwitchAuthProvider.StaticAuthProviderLive));
}

export class TwitchPubSubClient extends Context.Tag("twitch-pubsub-client")<
  TwitchPubSubClient,
  PubSubClient
>() {
  static Live = Layer.effect(
    this,
    Effect.map(TwitchAuthProvider, (authProvider) => {
      return new PubSubClient({
        authProvider,
        logger: { name: "chat", minLevel: LogLevel.WARNING },
      });
    }),
  ).pipe(Layer.provide(TwitchAuthProvider.StaticAuthProviderLive));
}

export class TwitchEventSubClient extends Context.Tag("twitch-pubsub-client")<
  TwitchPubSubClient,
  EventSubWsListener
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const apiClient = yield* TwitchApiClient;

      return new EventSubWsListener({
        apiClient,
      });
    }),
  ).pipe(Layer.provide(TwitchApiClient.Live));
}

const TwitchClientsLive = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Live,
  TwitchPubSubClient.Live,
  MessageQueue.Live,
  SpotifyApiClient.Live,
);

const songRequestRewardId = "1abfa295-f609-48f3-aaed-fd7a4b441e9e";

export type ITwitchService = Readonly<{
  sendMessage(message: string): Effect.Effect<void, Error>;
}>;

export class TwitchService extends Context.Tag("twitch-service")<
  TwitchService,
  ITwitchService
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const config = yield* TwitchConfig;
      const apiClient = yield* TwitchApiClient;
      const pubSubClient = yield* TwitchPubSubClient;
      const eventSubClient = yield* TwitchEventSubClient;
      const messageQueue = yield* MessageQueue;

      eventSubClient.onChannelChatMessage(
        config.broadcasterId,
        config.broadcasterId,
        (event) => {
          Effect.gen(function* () {
            if (event.messageText.startsWith("!")) {
              if (event.messageText === "!song") {
                yield* messageQueue.enqueue(Message.CurrentlyPlaying());
              }
            }
          });
        },
      );

      pubSubClient.onRedemption(config.broadcasterId, async (redemption) => {
        Effect.gen(function* () {
          if (redemption.rewardId === songRequestRewardId) {
            // TODO: Add error logging
            yield* Effect.tryPromise(() =>
              apiClient.chat.sendChatMessage(
                config.broadcasterId,
                `@${redemption.userName} requested ${redemption.message}!`,
              ),
            );

            yield* messageQueue.enqueue(
              Message.SongRequest({ uri: redemption.message }),
            );
          }
        });
      });

      return {
        sendMessage(message) {
          return Effect.tryPromise({
            try: async () => {
              return apiClient.chat.sendChatMessage(
                config.broadcasterId,
                message,
              );
            },
            catch: (error) => {
              return new Error(
                `An error occured while posting chat message to twitch: ${error}`,
              );
            },
          });
        },
      };
    }),
  );
}
