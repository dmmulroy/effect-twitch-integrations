import { Effect, Layer, Queue, Array } from "effect";
import { PubSubService } from "../../pubsub/client";
import { SpotifyApiClient } from "../api";
import { Message } from "../../pubsub/messages";
import type { Track } from "@spotify/web-api-ts-sdk";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SpotifySongQueueRequestSubscriber`);

	const spotify = yield* SpotifyApiClient;
	const pubsub = yield* PubSubService;

	const songRequestSubscriber = yield* pubsub.subscribeTo("SongQueueRequest");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* (_) {
				yield* Queue.take(songRequestSubscriber);

				const songQueue = yield* spotify
					.use((client) => client.player.getUsersQueue())
					.pipe(Effect.tapError(Effect.logError));

				// TODO: Remove cast
				const nextThreeSongs = Array.take(songQueue.queue, 3) as Track[];

				const chatMessage = `Song queue: ${nextThreeSongs
					.map(
						(song, idx) =>
							`${idx + 1}: ${song.name} by ${song.artists
								.map((artist) => artist.name)
								.join(", ")}`,
					)
					.join(" | ")}`;

				// TODO: Move this to a new pubsub subscriber in twitch and
				// publish Message.SonqQueue({ queue })
				yield* pubsub.publish(
					Message.SendTwitchChat({
						message: chatMessage,
					}),
				);
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	);

	yield* Effect.acquireRelease(
		Effect.logInfo(`SpotifySongQueueRequestSubscriber started`),
		() => Effect.logInfo(`SpotifySongQueueRequestSubscriber stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		module: "spotify-song-queue-request-subscriber",
	}),
);

export const SpotifySongQueueRequestSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubService.Live),
	Layer.provide(SpotifyApiClient.Live),
);
