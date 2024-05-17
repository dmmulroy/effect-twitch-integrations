import { Effect, Layer } from "effect";
import { Message, MessagePubSub } from "../pubsub/message-pubsub";
import { TwitchConfig } from "./twitch-config";
import { TwitchEventSubClient } from "./twitch-eventsub";

const make = Effect.gen(function* () {
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
		),
		(sub) => Effect.sync(() => sub.stop()),
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
		),
		(sub) => Effect.sync(() => sub.stop()),
	);
});

export const TwitchEventSubStreamLive = Layer.scopedDiscard(make).pipe(
	Layer.provide(TwitchEventSubClient.Live),
	Layer.provide(MessagePubSub.Live),
);

export const TwitchEventSubStreamTest = Layer.scopedDiscard(make).pipe(
	Layer.provide(TwitchEventSubClient.Test),
	Layer.provide(MessagePubSub.Live),
);
