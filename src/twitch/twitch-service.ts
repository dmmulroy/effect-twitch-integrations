import { Layer, Effect } from "effect";
import { TwitchConfig } from "./twitch-config";
import { TwitchApiClient } from "./twitch-api";
import { TwitchEventSubClient } from "./twitch-eventsub";
import { TwitchEventSubStream } from "./twitch-eventsub-stream";
import { TwitchCurrentlyPlayingSubscriber } from "./twitch-currently-playing-subscriber";

const TwitchServiceRequirementsLive = TwitchEventSubStream.Live.pipe(
	Layer.provide(TwitchCurrentlyPlayingSubscriber.Live),
	Layer.provide(TwitchConfig.Live),
	Layer.provide(TwitchApiClient.Live),
	Layer.provide(TwitchEventSubClient.Live),
);

export const TwitchClientsTest = TwitchEventSubStream.Live.pipe(
	Layer.provide(TwitchConfig.Live),
	Layer.provide(TwitchApiClient.Live),
	Layer.provide(TwitchEventSubClient.Test),
);

const make = Effect.gen(function* (_) {
	yield* Effect.logInfo(`Starting TwitchService`);
	yield* Effect.acquireRelease(Effect.logInfo(`TwitchService started`), () =>
		Effect.logInfo(`TwitchService stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		module: "twitch-service",
	}),
);

export const TwitchService = Layer.scopedDiscard(make).pipe(
	Layer.provide(TwitchServiceRequirementsLive),
);
