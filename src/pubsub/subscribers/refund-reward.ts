import { Effect, Layer, Queue } from "effect";
import { PubSubClient } from "../client";
import { TwitchApiClient } from "../../twitch/api";
import { TwitchConfig } from "../../twitch/config";
import { Message } from "../messages";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting RefundRewardSubscriber");

	const api = yield* TwitchApiClient;
	const config = yield* TwitchConfig;
	const pubsub = yield* PubSubClient;

	const subscriber = yield* pubsub.subscribeTo("RefundRewardRequest");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* (_) {
				const message = yield* Queue.take(subscriber);

				yield* api
					.use((client) =>
						client.channelPoints.updateRedemptionStatusByIds(
							config.broadcasterId,
							message.rewardId,
							[message.eventId],
							"CANCELED",
						),
					)
					.pipe(Effect.tapError(Effect.logError));

				yield* pubsub.publish(
					Message.SendTwitchChat({
						message: `@${message.requesterDisplayName} your points have been refunded`,
					}),
				);
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	).pipe(
		Effect.catchAllDefect(() =>
			Effect.logInfo("Stopped RefundRewardSubscriber"),
		),
	);

	yield* Effect.logInfo("RefundRewardSubscriber started");
}).pipe(
	Effect.annotateLogs({
		module: "send-twitch-shat-subscriber",
	}),
);

export const RefundRewardSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubClient.Live),
	Layer.provide(TwitchApiClient.Live),
);
