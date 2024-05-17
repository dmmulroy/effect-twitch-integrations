import { Effect, Layer } from "effect";
import { PubSubService } from "../pubsub/client";
import { SpotifyApiClient } from "./api";
import { SpotifyPubSubSubscribers } from "./pubsub-subscribers/subscribers";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SpotifyService`);

	yield* Effect.acquireRelease(Effect.logInfo(`SpotifyService started`), () =>
		Effect.logInfo(`SpotifyService stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "spotify-service" }));

export const SpotifyService = Layer.scopedDiscard(make).pipe(
	Layer.provide(SpotifyPubSubSubscribers),
	Layer.provide(SpotifyApiClient.Live),
	Layer.provide(PubSubService.Live),
);
