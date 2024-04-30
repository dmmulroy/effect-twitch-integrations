import { Context, Layer, Effect, Secret } from "effect";
import {
  RefreshingAuthProvider,
  StaticAuthProvider,
  type AuthProvider,
} from "@twurple/auth";
import { ChatClient, LogLevel } from "@twurple/chat";
import { PubSubClient } from "@twurple/pubsub";
import { TwitchConfig } from "./twitch-config-service";

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
  ).pipe(Layer.provide(TwitchAuthProvider.RefreshingAuthProviderLive));
}

const TwitchClientsLive = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchChatClient.Live,
  TwitchPubSubClient.Live,
);

export class TwitchService extends Context.Tag("twitch-service")<
  TwitchService,
  ITwitchService
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const config = yield* TwitchConfig;
      const chatClient = yield* TwitchChatClient;
      // const pubsubClient = yield* TwitchPubSubClient;

      // pubsubClient.onRedemption(config.broadcasterUsername, console.log);

      chatClient.connect();

      return {
        sendMessage(message) {
          return Effect.tryPromise({
            try: async () => {
              return await chatClient.say("dmmulroy", message);
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
