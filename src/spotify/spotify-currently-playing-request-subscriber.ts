import { Context, Effect, Layer, Queue } from "effect";
import { Message, MessagePubSub } from "../pubsub/message-pubsub";
import { SpotifyApiClient } from "./spotify-api";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SpotifyCurrentlyPlayingRequestSubscriber`);

	const spotify = yield* SpotifyApiClient;
	const pubsub = yield* MessagePubSub;

	const currentPlayingSubscriber = yield* pubsub.subscribeTo(
		"CurrentlyPlayingRequest",
	);

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* () {
				const message = yield* Queue.take(currentPlayingSubscriber);

				yield* Effect.logInfo(
					`Received a CurrentlyPlayingRequestMessage from @${message.requesterDisplayName}`,
				);

				const { item } = yield* spotify
					.use((client) => client.player.getCurrentlyPlayingTrack())
					.pipe(
						Effect.tapError((error) =>
							Effect.gen(function* () {
								yield* Effect.logError(
									`An error occured while getting the currently playing track`,
									error,
								);

								yield* pubsub.publish(
									Message.SongRequestError({
										requesterDisplayName: message.requesterDisplayName,
										cause: error,
									}),
								);
							}),
						),
					);

				yield* Effect.logInfo(
					`Successfully fetched currently playing track: ${item.uri}`,
				);

				if (!("album" in item)) {
					yield* Effect.logWarning(
						`The currently playing item is not a song: ${item.uri}`,
					);

					yield* pubsub.publish(
						Message.InvalidSongRequest({
							requesterDisplayName: message.requesterDisplayName,
							reason: "The currently playing item is not a song",
						}),
					);

					return;
				}

				yield* pubsub.publish(
					Message.CurrentlyPlaying({
						song: item.name,
						artists: item.artists.map((artist) => artist.name),
						requesterDisplayName: message.requesterDisplayName,
					}),
				);
			}),
		),
	);

	yield* Effect.acquireRelease(
		Effect.logInfo(`SpotifyCurrentlyPlayingRequestSubscriber started`),
		() => Effect.logInfo(`SpotifyCurrentlyPlayingRequestSubscriber stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		module: "spotify-currently-playing-request-subscriber",
	}),
);

export class SpotifyCurrentlyPlayingRequestSubscriber extends Context.Tag(
	"spotify-currently-playing-request-subscriber",
)<SpotifyCurrentlyPlayingRequestSubscriber, never>() {
	static Live = Layer.scopedDiscard(make);
}
