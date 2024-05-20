import { Effect, Layer } from "effect";
import { PubSubService } from "../../pubsub/client";
import { TwitchConfig } from "../config";
import { TwitchEventSubClient } from "../eventsub";
import { Message } from "../../pubsub/messages";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchEventSubChannelRedemptionAddForReward");

	const config = yield* TwitchConfig;
	const eventsub = yield* TwitchEventSubClient;
	const pubsub = yield* PubSubService;

	yield* Effect.acquireRelease(
		Effect.sync(() =>
			eventsub.onChannelRedemptionAddForReward(
				config.broadcasterId,
				config.songRequestRewardId,
				(event) =>
					pubsub.unsafePublish(
						Message.SongRequest({
							eventId: event.id,
							rewardId: event.rewardId,
							requesterDisplayName: event.userDisplayName,
							url: event.input,
						}),
					),
			),
		).pipe(
			Effect.tap(
				Effect.log("Started TwitchEventSubChannelRedemptionAddForReward"),
			),
		),
		(subscription) =>
			Effect.sync(() => subscription.stop()).pipe(
				Effect.tap(
					Effect.log("Stopped TwitchEventSubChannelRedemptionAddForReward"),
				),
			),
	);
}).pipe(
	Effect.annotateLogs({
		module: "twitch-eventsub-channel-redemption-add-for-rewards-subscriber",
	}),
);

export const TwitchEventSubChannelRedemptionAddForReward = {
	Live: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubClient.Live),
		Layer.provide(PubSubService.Live),
	),

	Test: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubClient.Test),
		Layer.provide(PubSubService.Live),
	),
} as const;
