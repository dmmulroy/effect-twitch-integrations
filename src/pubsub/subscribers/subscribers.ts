import { Effect, Layer } from "effect";
import { CurrentlyPlayingRequestSubscriber } from "./currently-playing-request";
import { SongRequestSubscriber } from "./song-request";
import { SongQueueRequestSubscriber } from "./song-queue-request";
import { CurrentlyPlayingSubscriber } from "./currently-playing";
import { SendTwitchShatSubscriber } from "./send-twitch-shat";
import { SongQueueSubscriber } from "./song-queue";
import { RefundRewardSubscriber } from "./refund-reward";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting PubSubSubscribers");

	yield* Effect.acquireRelease(
		Effect.logInfo(`PubSubSubscribers started`),
		() => Effect.logInfo(`PubSubSubscribers stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "pubsub-subscribers" }));

export const PubSubSubscribers = Layer.scopedDiscard(make).pipe(
	Layer.provide(CurrentlyPlayingRequestSubscriber),
	Layer.provide(CurrentlyPlayingSubscriber),
	Layer.provide(SendTwitchShatSubscriber),
	Layer.provide(SongRequestSubscriber),
	Layer.provide(SongQueueSubscriber),
	Layer.provide(SongQueueRequestSubscriber),
	Layer.provide(RefundRewardSubscriber),
);
