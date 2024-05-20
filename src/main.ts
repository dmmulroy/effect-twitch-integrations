import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { SpotifyService } from "./spotify/service";
import { TwitchService } from "./twitch/service";
import { PubSubSubscribers } from "./pubsub/subscribers/subscribers";

const BunTime = {
	funTime: BunRuntime.runMain,
};

const MainLive = Layer.mergeAll(
	TwitchService,
	SpotifyService,
	PubSubSubscribers,
);

BunTime.funTime(Layer.launch(MainLive));
