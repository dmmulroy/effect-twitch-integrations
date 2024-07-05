import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { SpotifyService } from "./spotify/service";
import { TwitchService } from "./twitch/service";
import { PubSubSubscribers } from "./pubsub/subscribers/subscribers";
import { SongQueueClient } from "./song-queue/client";
import { ApiServer } from "./api/server";
import { NixTimerClient } from "./nix-timer/client";

const BunTime = {
  funTime: BunRuntime.runMain,
};

const MainLive = Layer.mergeAll(
  TwitchService,
  SpotifyService,
  PubSubSubscribers,
  ApiServer,
).pipe(Layer.provide(SongQueueClient.Live), Layer.provide(NixTimerClient.Live));

BunTime.funTime(Layer.launch(MainLive));
