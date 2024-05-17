import { Effect, Layer } from "effect";
import { TwitchEventSubChannelChatMessageSubscriber } from "./channel-chat-message-subscriber";
import { TwitchEventSubChannelRedemptionAddForReward } from "./channel-redemption-add-for-reward";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchEventSubSubscribers");

	yield* Effect.acquireRelease(
		Effect.logInfo(`TwitchEventSubSubscribers started`),
		() => Effect.logInfo(`TwitchEventSubSubscribers stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "twitch-eventsub-subscribers" }));

export const TwitchEventSubSubscribers = {
	Live: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubChannelChatMessageSubscriber.Live),
		Layer.provide(TwitchEventSubChannelRedemptionAddForReward.Live),
	),

	Test: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubChannelChatMessageSubscriber.Test),
		Layer.provide(TwitchEventSubChannelRedemptionAddForReward.Test),
	),
} as const;
