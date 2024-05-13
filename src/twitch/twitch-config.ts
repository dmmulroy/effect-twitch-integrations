import { Config, Context, Effect, Layer, Secret } from "effect";

export type ITwitchConfig = Readonly<{
  accessToken: Secret.Secret;
  clientId: string;
  clientSecret: Secret.Secret;
  broadcasterId: string;
  broadcasterUsername: string;
  scopes: Array<string>;
  songRequestRewardId: string;
}>;

export const makeTwitchConfig = Effect.gen(function* () {
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
      "user:read:chat",
    ],
    songRequestRewardId: "1abfa295-f609-48f3-aaed-fd7a4b441e9e",
  };
});

export class TwitchConfig extends Context.Tag("twitch-config")<
  TwitchConfig,
  ITwitchConfig
>() {
  static Live = Layer.effect(this, makeTwitchConfig);
}
