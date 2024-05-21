import { Effect, Layer, Queue } from "effect";
import { PubSubClient } from "../client";
import { TwitchApiClient } from "../../twitch/api";
import { TwitchConfig } from "../../twitch/config";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting SendTwitchShatSubscriber");

	const api = yield* TwitchApiClient;
	const config = yield* TwitchConfig;
	const pubsub = yield* PubSubClient;

	const subscriber = yield* pubsub.subscribeTo("SendTwitchChat");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* (_) {
				const { message } = yield* Queue.take(subscriber);

				yield* api
					.use((client) =>
						client.chat.sendChatMessage(config.broadcasterId, message),
					)
					.pipe(Effect.tapError(Effect.logError));
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	).pipe(
		Effect.catchAllDefect(() =>
			Effect.logInfo("Stopped SendTwitchShatSubscriber"),
		),
	);

	yield* Effect.logInfo("SendTwitchShatSubscriber started");
}).pipe(
	Effect.annotateLogs({
		module: "send-twitch-shat-subscriber",
	}),
);

export const SendTwitchShatSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubClient.Live),
	Layer.provide(TwitchApiClient.Live),
);
