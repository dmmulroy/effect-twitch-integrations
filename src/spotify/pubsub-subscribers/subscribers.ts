import { Effect, Layer } from "effect";
import { SpotifyCurrentlyPlayingRequestSubscriber } from "./currently-playing-request-subscriber";
import { SpotifySongRequestSubscriber } from "./song-request-subscriber";
import { SpotifySongQueueRequestSubscriber } from "./song-queue-request-subscriber";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting SpotifyPubSubSubscribers");

	yield* Effect.acquireRelease(
		Effect.logInfo(`SpotifyPubSubSubscribers started`),
		() => Effect.logInfo(`SpotifyPubSubSubscribers stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "spotify-pubsub-subscribers" }));

export const SpotifyPubSubSubscribers = Layer.scopedDiscard(make).pipe(
	Layer.provide(SpotifyCurrentlyPlayingRequestSubscriber),
	Layer.provide(SpotifySongRequestSubscriber),
	Layer.provide(SpotifySongQueueRequestSubscriber),
);
