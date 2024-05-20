import { Effect, Layer, Queue, Option } from "effect";
import { PubSubService } from "../client";
import { SpotifyApiClient } from "../../spotify/api";
import { SpotifyError } from "../../spotify/error";
import { Message } from "../messages";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SongRequestSubscriber`);

	const spotify = yield* SpotifyApiClient;
	const pubsub = yield* PubSubService;

	const songRequestSubscriber = yield* pubsub.subscribeTo("SongRequest");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* () {
				const message = yield* Queue.take(songRequestSubscriber);

				const songId = yield* getSongIdFromUrl(message.url).pipe(
					Effect.tapError((error) =>
						Effect.gen(function* () {
							yield* Effect.logError(error);

							yield* pubsub.publish(
								Message.SendTwitchChat({
									message: `@${message.requesterDisplayName} your song request was invalid. Did your request a podcast? 🤨`,
								}),
							);
						}),
					),
				);

				yield* spotify
					.use((client) =>
						client.player.addItemToPlaybackQueue(`spotify:track:${songId}`),
					)
					.pipe(Effect.tapError(Effect.logError));

				const track = yield* spotify.use((client) => client.tracks.get(songId));

				yield* pubsub.publish(
					Message.SendTwitchChat({
						message: `@${message.requesterDisplayName} requested ${
							track.name
						} by ${track.artists.map((artist) => artist.name).join(", ")}`,
					}),
				);
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	);

	yield* Effect.acquireRelease(
		Effect.logInfo(`SongRequestSubscriber started`),
		() => Effect.logInfo(`SongRequestSubscriber stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		module: "song-request-subscriber",
	}),
);

export const SongRequestSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubService.Live),
	Layer.provide(SpotifyApiClient.Live),
);

const songIdRegex = new RegExp(/\/track\/([a-zA-z0-9]*)/);

function getSongIdFromUrl(url: string): Effect.Effect<string, SpotifyError> {
	return Option.fromNullable(songIdRegex.exec(url)).pipe(
		Option.map(([, songId]) => songId),
		Effect.mapError(
			() => new SpotifyError({ cause: `Invalid song url: ${url}` }),
		),
	);
}
