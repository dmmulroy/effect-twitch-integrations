import { Effect, Layer, Queue, Random, Schedule } from "effect";
import { PubSubClient } from "../client";
import { Message } from "../messages";
import { TwitchApiClient } from "../../twitch/api";
import { TwitchConfig } from "../../twitch/config";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting KeyboardRaffleSubscriber");

	const pubsub = yield* PubSubClient;
	const twitch = yield* TwitchApiClient;
	const twitchConfig = yield* TwitchConfig;
	const subscriber = yield* pubsub.subscribeTo("KeyboardRaffleRequest");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* () {
				const { requesterDisplayName, eventId, rewardId } =
					yield* Queue.take(subscriber);

				const winningNumber = yield* Random.nextIntBetween(1, 10_000);
				const rolledNumber = yield* Random.nextIntBetween(1, 10_000);

				if (winningNumber === rolledNumber) {
					const message = `@${requesterDisplayName} won 🎉 The winning number was ${winningNumber} and they rolled it!`;
					yield* Effect.logInfo(message);
					yield* pubsub.publish(Message.SendTwitchChat({ message }));
					return;
				}

				const message = `@${requesterDisplayName} lost 😭 The winning number was ${winningNumber} and they rolled ${rolledNumber}`;
				yield* Effect.logInfo(message);
				yield* pubsub.publish(Message.SendTwitchChat({ message }));

				yield* twitch
					.use((client) =>
						client.channelPoints.updateRedemptionStatusByIds(
							twitchConfig.broadcasterId,
							rewardId,
							[eventId],
							"FULFILLED",
						),
					)
					.pipe(
						Effect.retry({
							times: 3,
							schedule: Schedule.fixed("250 millis"),
						}),
					)
					.pipe(
						Effect.tapError((error) =>
							Effect.logError({
								error,
								cause: error.cause,
							}),
						),
					);
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	).pipe(
		Effect.catchAllDefect(() =>
			Effect.logInfo("Stopped KeyboardRaffleSubscriber"),
		),
	);

	yield* Effect.logInfo("KeyboardRaffleSubscriber started");
}).pipe(
	Effect.annotateLogs({
		module: "keyboard-raffle-subscriber",
	}),
);

export const KeyboardRaffleSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubClient.Live),
	Layer.provide(TwitchApiClient.Live),
);
