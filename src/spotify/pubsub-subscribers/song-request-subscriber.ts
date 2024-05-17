import { Effect, Layer, Queue, Option } from "effect";
import { PubSubService } from "../../pubsub/client";
import { SpotifyApiClient } from "../api";
import { SpotifyError } from "../error";
import { Message } from "../../pubsub/messages";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SpotifySongRequestSubscriber`);

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
		Effect.logInfo(`SpotifySongRequestSubscriber started`),
		() => Effect.logInfo(`SpotifySongRequestSubscriber stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		module: "spotify-currently-playing-request-subscriber",
	}),
);

export const SpotifySongRequestSubscriber = Layer.scopedDiscard(make).pipe(
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