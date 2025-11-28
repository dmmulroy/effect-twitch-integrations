import { Config } from "effect";

export const TwitchConfig = Config.all({
  clientId: Config.string("TWITCH_CLIENT_ID"),
  clientSecret: Config.redacted("TWITCH_CLIENT_SECRET"),
  accessToken: Config.redacted("TWITCH_ACCESS_TOKEN"),
  refreshToken: Config.redacted("TWITCH_REFRESH_TOKEN").pipe(
    Config.withDefault(null),
  ),
}).pipe(
  Config.map(({ clientId, clientSecret, accessToken, refreshToken }) => ({
    accessToken,
    refreshToken,
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
    songRequestRewardId: "c2063c79-a24c-4b17-94f7-c871f2876708",
    keyboardRaffleRewardId: "29afa291-244a-47a8-8be8-ded13995e83d",
  })),
);

// bits:read channel:bot channel:manage:broadcast channel:manage:redemptions channel:read:redemptions chat:edit chat:read moderator:read:chatters user:bot user:edit user:write:chat user:read:chat
