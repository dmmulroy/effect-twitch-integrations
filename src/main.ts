import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { SpotifyService } from "./spotify/service";
import { TwitchService } from "./twitch/service";
import { PubSubSubscribers } from "./pubsub/subscribers/subscribers";
import { SongQueueClient } from "./song-queue/client";

const BunTime = {
  funTime: BunRuntime.runMain,
};

const MainLive = Layer.mergeAll(
  TwitchService,
  SpotifyService,
  PubSubSubscribers,
).pipe(Layer.provide(SongQueueClient.Live));

BunTime.funTime(Layer.launch(MainLive));
