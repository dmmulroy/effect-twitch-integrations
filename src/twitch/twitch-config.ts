import { Config, Context, Effect, Layer, Secret } from "effect";

export const TwitchConfig = Config.all({
  clientId: Config.string("TWITCH_CLIENT_ID"),
  clientSecret: Config.secret("TWITCH_CLIENT_SECRET"),
  accessToken: Config.secret("TWITCH_ACCESS_TOKEN"),
}).pipe(
  Config.map(({ clientId, clientSecret, accessToken }) => ({
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
  })
))
