import { Effect, Layer, Queue } from "effect";
import { PubSubService } from "../../pubsub/client";
import { TwitchApiClient } from "../api";
import { TwitchConfig } from "../config";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting TwitchSendTwitchShatSubscriber");

	const api = yield* TwitchApiClient;
	const config = yield* TwitchConfig;
	const pubsub = yield* PubSubService;

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
			Effect.logInfo("Stopped TwitchSendTwitchShatSubscriber"),
		),
	);

	yield* Effect.logInfo("TwitchSendTwitchShatSubscriber started");
}).pipe(
	Effect.annotateLogs({
		module: "twitch-send-twitch-shat-subscriber",
	}),
);

export const TwitchSendTwitchShatSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubService.Live),
	Layer.provide(TwitchApiClient.Live),
);
