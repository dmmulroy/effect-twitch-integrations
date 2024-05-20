import { Effect, Layer } from "effect";
import { PubSubService } from "../../pubsub/client";
import { TwitchConfig } from "../config";
import { TwitchEventSubClient } from "../eventsub";
import { Message } from "../../pubsub/messages";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchEventSubChannelChatMessageSubscriber");

	const config = yield* TwitchConfig;
	const eventsub = yield* TwitchEventSubClient;
	const pubsub = yield* PubSubService;

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
						return;
					}

					if (event.messageText === "!queue") {
						pubsub.unsafePublish(Message.SongQueueRequest());
						return;
					}
				},
			),
		).pipe(
			Effect.tap(
				Effect.log("Started TwitchEventSubChannelChatMessageSubscriber"),
			),
		),
		(subscription) =>
			Effect.sync(() => subscription.stop()).pipe(
				Effect.tap(
					Effect.log("Stopped TwitchEventSubChannelChatMessageSubscriber"),
				),
			),
	);
}).pipe(
	Effect.annotateLogs({
		module: "twitch-eventsub-channel-chat-message-subscriber",
	}),
);

export const TwitchEventSubChannelChatMessageSubscriber = {
	Live: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubClient.Live),
		Layer.provide(PubSubService.Live),
	),

	Test: Layer.scopedDiscard(make).pipe(
		Layer.provide(TwitchEventSubClient.Test),
		Layer.provide(PubSubService.Live),
	),
} as const;
