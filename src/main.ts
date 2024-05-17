import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { SpotifyService } from "./spotify/spotify-service";
import { TwitchService } from "./twitch/twitch-service";

const BunTime = {
	funTime: BunRuntime.runMain,
};

const MainLive = Layer.mergeAll(TwitchService, SpotifyService);

BunTime.funTime(Layer.launch(MainLive));
