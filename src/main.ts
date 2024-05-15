import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { MessagePubSub } from "./pubsub/message-pubsub";
import { SpotifyService } from "./spotify/spotify-service";
import { TwitchService } from "./twitch/twitch-service";

const BunTime = {
  funTime: BunRuntime.runMain,
};

const MainLive = Layer.provide(
  Layer.mergeAll(TwitchService, SpotifyService),
  MessagePubSub.Live,
);

BunTime.funTime(Layer.launch(MainLive));
