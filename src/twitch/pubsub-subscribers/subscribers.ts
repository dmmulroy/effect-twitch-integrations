import { Effect, Layer } from "effect";
import { TwitchCurrentlyPlayingSubscriber } from "./currently-playing-subscriber";
import { TwitchSendTwitchShatSubscriber } from "./send-twitch-shat-subscriber";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchPubSubSubscribers");

	yield* Effect.acquireRelease(
		Effect.logInfo(`TwitchPubSubSubscribers started`),
		() => Effect.logInfo(`TwitchPubSubSubscribers stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "twitch-pubsub-subscribers" }));

export const TwitchPubSubSubscribers = Layer.scopedDiscard(make).pipe(
	Layer.provide(TwitchCurrentlyPlayingSubscriber),
	Layer.provide(TwitchSendTwitchShatSubscriber),
);
