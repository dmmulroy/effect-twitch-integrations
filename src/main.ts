import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { SpotifyService } from "./spotify/service";
import { TwitchService } from "./twitch/service";

const BunTime = {
	funTime: BunRuntime.runMain,
};

const MainLive = Layer.mergeAll(TwitchService, SpotifyService);

BunTime.funTime(Layer.launch(MainLive));
