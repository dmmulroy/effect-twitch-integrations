import { Effect, Layer, Queue, Array, pipe } from "effect";
import { PubSubService } from "../client";
import { TwitchApiClient } from "../../twitch/api";
import { TwitchConfig } from "../../twitch/config";
import type { Track } from "@spotify/web-api-ts-sdk";

const make = Effect.gen(function* () {
	yield* Effect.logInfo("Starting SongQueueSubscriber");

	const api = yield* TwitchApiClient;
	const config = yield* TwitchConfig;
	const pubsub = yield* PubSubService;

	const subscriber = yield* pubsub.subscribeTo("SongQueue");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* () {
				const { queue } = yield* Queue.take(subscriber);

				const nextThreeSongs = pipe(
					queue.queue,
					Array.flatMap((item) => {
						if ("album" in item) {
							return [item];
						}
						return [];
					}),
					Array.take(3),
				);

				const chatMessage = `Song queue: ${nextThreeSongs
					.map(
						(song, idx) =>
							`${idx + 1}: ${song.name} by ${song.artists
								.map((artist) => artist.name)
								.join(", ")}`,
					)
					.join(" | ")}`;

				yield* api
					.use((client) =>
						client.chat.sendChatMessage(config.broadcasterId, chatMessage),
					)
					.pipe(Effect.tapError(Effect.logError));
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	).pipe(
		Effect.catchAllDefect(() => Effect.logInfo("Stopped SongQueueSubscriber")),
	);

	yield* Effect.logInfo("SongQueueSubscriber started");
}).pipe(
	Effect.annotateLogs({
		module: "song-queue-subscriber",
	}),
);

export const SongQueueSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubService.Live),
	Layer.provide(TwitchApiClient.Live),
);
