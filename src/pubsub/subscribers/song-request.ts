import { Effect, Layer, Queue, Option, Schedule } from "effect";
import { PubSubClient, type IPubSubService } from "../client";
import { SpotifyApiClient } from "../../spotify/api";
import { SpotifyError } from "../../spotify/error";
import { Message, type SongRequestMessage } from "../messages";
import { TwitchApiClient } from "../../twitch/api";
import { TwitchConfig } from "../../twitch/config";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SongRequestSubscriber`);

	const spotify = yield* SpotifyApiClient;
	const twitch = yield* TwitchApiClient;
	const twitchConfig = yield* TwitchConfig;
	const pubsub = yield* PubSubClient;

	const songRequestSubscriber = yield* pubsub.subscribeTo("SongRequest");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* (_) {
				const message = yield* Queue.take(songRequestSubscriber);

				const handleError = makeErrorHandler(message, pubsub);

				const songId = yield* getSongIdFromUrl(message.url).pipe(handleError);

				yield* spotify
					.use((client) =>
						client.player.addItemToPlaybackQueue(`spotify:track:${songId}`),
					)
					.pipe(handleError);

				const track = yield* spotify
					.use((client) => client.tracks.get(songId))
					.pipe(handleError);

				yield* pubsub.publish(
					Message.SendTwitchChat({
						message: `@${message.requesterDisplayName} requested ${
							track.name
						} by ${track.artists.map((artist) => artist.name).join(", ")}`,
					}),
				);

				yield* twitch
					.use((client) =>
						client.channelPoints.updateRedemptionStatusByIds(
							twitchConfig.broadcasterId,
							message.rewardId,
							[message.eventId],
							"FULFILLED",
						),
					)
					.pipe(
						Effect.retry({
							times: 3,
							schedule: Schedule.fixed("250 millis"),
						}),
					)
					.pipe(Effect.tapError(Effect.logError));

				yield* pubsub.publish(
					Message.SongAddedToSpotifyQueue({
						requesterDisplayName: message.requesterDisplayName,
						trackId: track.id,
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
	Layer.provide(PubSubClient.Live),
	Layer.provide(SpotifyApiClient.Live),
	Layer.provide(TwitchApiClient.Live),
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

function makeErrorHandler(message: SongRequestMessage, pubsub: IPubSubService) {
	return Effect.tapError((error) => {
		return Effect.logError(error).pipe(
			Effect.andThen(() =>
				pubsub.publish(
					Message.SendTwitchChat({
						message: `@${message.requesterDisplayName} your song request was invalid and your points are being redeemed. Did you use a proper spotify song link? 🤨`,
					}),
				),
			),
			Effect.andThen(() =>
				pubsub.publish(
					Message.RefundRewardRequest({
						rewardId: message.rewardId,
						eventId: message.eventId,
						requesterDisplayName: message.requesterDisplayName,
					}),
				),
			),
		);
	});
}
