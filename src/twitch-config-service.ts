import { Config, Context, Effect, Layer, Secret } from "effect";
/* import accessTokenJson from "./access-token.json";

const accessTokenString = JSON.stringify(accessTokenJson); */

export type ITwitchConfig = Readonly<{
  accessToken: Secret.Secret;
  clientId: string;
  clientSecret: Secret.Secret;
  broadcasterId: string;
  broadcasterUsername: string;
  scopes: Array<string>;
}>;

export class TwitchConfig extends Context.Tag("twitch-config")<
  TwitchConfig,
  ITwitchConfig
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const clientId = yield* Config.string("TWITCH_CLIENT_ID");
      const clientSecret = yield* Config.secret("TWITCH_CLIENT_SECRET");
      const accessToken = yield* Config.secret("TWITCH_ACCESS_TOKEN");

      return {
        accessToken,
        clientId,
        clientSecret,
        broadcasterId: "209286766",
        broadcasterUsername: "dmmulroy",
        scopes: [
          "bits:read",
          "channel:bot",
          "channel:manage:broadcast",
          "channel:manage:redemptions",
          "channel:read:redemptions",
          "chat:edit",
          "chat:read",
          "moderator:read:chatters",
          "user:bot",
          "user:edit",
          "user:write:chat",
          "whispers:edit",
          "whispers:read",
        ],
      };
    }),
  );
}
