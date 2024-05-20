import { Layer, Effect } from "effect";
import { TwitchApiClient } from "./api";
import { TwitchEventSubSubscribers } from "./eventsub-subscribers/subscribers";
import { PubSubService } from "../pubsub/client";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting TwitchService`);

	yield* Effect.acquireRelease(Effect.logInfo(`TwitchService started`), () =>
		Effect.logInfo(`TwitchService stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "twitch-service" }));

export const TwitchService = Layer.scopedDiscard(make).pipe(
	Layer.provide(TwitchEventSubSubscribers.Live),
	Layer.provide(TwitchApiClient.Live),
	Layer.provide(PubSubService.Live),
);
