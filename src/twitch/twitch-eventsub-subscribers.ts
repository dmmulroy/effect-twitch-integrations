import { Effect, Layer } from "effect";
import { Message, MessagePubSub } from "../pubsub/message-pubsub";
import { TwitchConfig } from "./twitch-config";
import { TwitchEventSubClient } from "./twitch-eventsub";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchEventSubSubscribers");

	const config = yield* TwitchConfig;
	const eventsub = yield* TwitchEventSubClient;
	const pubsub = yield* MessagePubSub;

	yield* Effect.acquireRelease(
		Effect.sync(() =>
			eventsub.onChannelChatMessage(
				config.broadcasterId,
				config.broadcasterId,
				(event) => {
					if (event.messageText === "!song") {
						pubsub.unsafePublish(
							Message.CurrentlyPlayingRequest({
								requesterDisplayName: event.chatterDisplayName,
							}),
						);
					}
				},
			),
		).pipe(Effect.tap(Effect.log("Started onChannelChatMessage subscription"))),
		(subscription) =>
			Effect.sync(() => subscription.stop()).pipe(
				Effect.tap(Effect.log("Stopped onChannelChatMessage subscription")),
			),
	).pipe(
		Effect.annotateLogs({
			module: "twitch-eventsub-on-channel-chat-message",
		}),
	);

	yield* Effect.acquireRelease(
		Effect.sync(() =>
			eventsub.onChannelRedemptionAddForReward(
				config.broadcasterId,
				config.songRequestRewardId,
				(event) =>
					pubsub.unsafePublish(
						Message.SongRequest({
							requesterDisplayName: event.userDisplayName,
							url: event.input,
						}),
					),
			),
		).pipe(
			Effect.tap(
				Effect.log("Started onChannelRedemptionAddForReward subscription"),
			),
		),
		(sub) =>
			Effect.sync(() => sub.stop()).pipe(
				Effect.tap(
					Effect.log("Stopped onChannelRedemptionAddForReward subscription"),
				),
			),
	).pipe(
		Effect.annotateLogs({
			module: "twitch-eventsub-on-channel-redemption-add-for-reward",
		}),
	);

	yield* Effect.logInfo("TwitchEventSubSubscribers started");

	yield* Effect.addFinalizer(() =>
		Effect.logInfo(`TwitchEventSubSubscribers stopped`),
	);
});

export const TwitchEventSubSubscribers = {
	Live: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubClient.Live),
		Layer.provide(MessagePubSub.Live),
	),

	Test: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubClient.Test),
		Layer.provide(MessagePubSub.Live),
	),
} as const;
