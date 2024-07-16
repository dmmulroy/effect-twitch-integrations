import { Config } from "effect";

export const TwitchConfig = Config.all({
  clientId: Config.string("TWITCH_CLIENT_ID"),
  clientSecret: Config.redacted("TWITCH_CLIENT_SECRET"),
  accessToken: Config.redacted("TWITCH_ACCESS_TOKEN"),
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
    songRequestRewardId: "c2063c79-a24c-4b17-94f7-c871f2876708",
    keyboardRaffleRewardId: "f1fd568d-6998-4de1-a6bb-a0205cafe91b",
  })),
);
