import { Context, Effect, Layer, Queue } from "effect";
import { PubSubService } from "../client";
import { SpotifyApiClient } from "../../spotify/api";
import { Message } from "../messages";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting CurrentlyPlayingRequestSubscriber`);

	const spotify = yield* SpotifyApiClient;
	const pubsub = yield* PubSubService;

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
									Message.SendTwitchChat({
										message: `@${message.requesterDisplayName} your request for the currently playing song failed 😭`,
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

					return;
				}

				yield* pubsub.publish(
					Message.CurrentlyPlaying({
						song: item.name,
						artists: item.artists.map((artist) => artist.name),
						requesterDisplayName: message.requesterDisplayName,
					}),
				);
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	);

	yield* Effect.acquireRelease(
		Effect.logInfo(`CurrentlyPlayingRequestSubscriber started`),
		() => Effect.logInfo(`CurrentlyPlayingRequestSubscriber stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		module: "currently-playing-request-subscriber",
	}),
);

export const CurrentlyPlayingRequestSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubService.Live),
	Layer.provide(SpotifyApiClient.Live),
);
