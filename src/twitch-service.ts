import { Context, Layer, Effect, Secret } from "effect";
import {
  RefreshingAuthProvider,
  StaticAuthProvider,
  type AuthProvider,
} from "@twurple/auth";
import { ChatClient, LogLevel } from "@twurple/chat";
import { PubSubClient } from "@twurple/pubsub";
import { TwitchConfig } from "./twitch-config-service";
import { ApiClient } from "@twurple/api";
import { SongQueue } from "./song-queue";

export type ITwitchService = Readonly<{
  sendMessage(message: string): Effect.Effect<void, Error>;
}>;

class TwitchAuthProvider extends Context.Tag("twitch-auth-provider")<
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

class TwitchApiClient extends Context.Tag("twitch-api-client")<
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

// Have compile time warning if Context.Tag is called with the same value more than once
export class TwitchChatClient extends Context.Tag("twitch-chat-client")<
  TwitchChatClient,
  ChatClient
>() {
  static Live = Layer.effect(
    this,
    Effect.map(TwitchAuthProvider, (authProvider) => {
      return new ChatClient({
        authProvider,
        channels: ["dmmulroy"],
        logger: { name: "chat", minLevel: LogLevel.WARNING },
      });
    }),
  ).pipe(Layer.provide(TwitchAuthProvider.StaticAuthProviderLive));
}

class TwitchPubSubClient extends Context.Tag("twitch-pubsub-client")<
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

const TwitchClientsLive = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchPubSubClient.Live,
  SongQueue.Live,
);

const songRequestRewardId = "1abfa295-f609-48f3-aaed-fd7a4b441e9e";

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
      const songQueue = yield* SongQueue;

      pubSubClient.onRedemption(config.broadcasterId, async (redemption) => {
        if (redemption.rewardId === songRequestRewardId) {
          await apiClient.chat.sendChatMessage(
            config.broadcasterId,
            `@${redemption.userName} requested ${redemption.message}!`,
          );

          const _exit = songQueue
            .enqueue(redemption.message)
            .pipe(Effect.runPromiseExit);
        }
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
  ).pipe(Layer.provide(TwitchClientsLive));
}
