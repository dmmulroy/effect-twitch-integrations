import { BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Scope } from "effect";
import { TwitchService } from "./twitch-service";
import { SpotifyService } from "./spotify-service";
import { MessagePubSub } from "./message-pubsub";

const BunTime = {
  funTime: BunRuntime.runMain,
};

const MainLive = Layer.provide(
  Layer.mergeAll(TwitchService, SpotifyService),
  MessagePubSub.Live,
);

export const run = () => BunTime.funTime(Layer.launch(MainLive));
