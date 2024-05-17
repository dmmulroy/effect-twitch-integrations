import { Layer, Effect, Queue } from "effect";
import { TwitchConfig } from "./twitch-config";
import { TwitchApiClient } from "./twitch-api";
import {
	TwitchEventSubStreamLive,
	TwitchEventSubStreamTest,
} from "./twitch-eventsub-stream";
import { MessagePubSub } from "../pubsub/message-pubsub";

const TwitchCurrentlyPlaying = Effect.gen(function* (_) {
	yield* Effect.logInfo(`Starting TwitchService`);

	const api = yield* TwitchApiClient;
	const config = yield* TwitchConfig;
	const pubsub = yield* MessagePubSub;

	const currentlyPlayingSubscriber =
		yield* pubsub.subscribeTo("CurrentlyPlaying");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* (_) {
				const { song, artists, requesterDisplayName } = yield* Queue.take(
					currentlyPlayingSubscriber,
				);

				const message = `Current song: ${song} by ${artists.join(", ")}`;

				yield* Effect.logInfo(
					`Received a CurrentlyPlayingMessage for @${requesterDisplayName}. ${message}`,
				);

				yield* api
					.use((client) =>
						client.chat.sendChatMessage(config.broadcasterId, message),
					)
					.pipe(Effect.tapError(Effect.logError));

				yield* Effect.logInfo(
					`Successfully sent CurrentlyPlayingMessage to twitch for @${requesterDisplayName}`,
				);
			}),
		),
	).pipe(
		Effect.annotateLogs({
			fiber_name: "twitch-service-currently-playing-fiber",
		}),
	);

	yield* Effect.acquireRelease(Effect.logInfo(`TwitchService started`), () =>
		Effect.logInfo(`TwitchService stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		fiber_name: "twitch-service",
	}),
	Layer.scopedDiscard,
	Layer.provide(MessagePubSub.Live),
	Layer.provide(TwitchApiClient.Live),
);

export const TwitchServiceLive = Layer.mergeAll(
	TwitchCurrentlyPlaying,
	TwitchEventSubStreamLive,
);

export const TwitchServiceTest = Layer.mergeAll(
	TwitchCurrentlyPlaying,
	TwitchEventSubStreamTest,
);
