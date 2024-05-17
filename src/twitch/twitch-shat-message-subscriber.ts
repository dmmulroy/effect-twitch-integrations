import { Context, Effect, Layer, Queue } from "effect";
import { MessagePubSub } from "../pubsub/message-pubsub";
import { TwitchApiClient } from "./twitch-api";
import { TwitchConfig } from "./twitch-config";

const make = Effect.gen(function* () {
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
			module: "twitch-currently-playing-subscriber",
		}),
	);
});

export class TwitchCurrentlyPlayingSubscriber extends Context.Tag(
	"twitch-
  subscriber",
)<TwitchCurrentlyPlayingSubscriber, never>() {
	static Live = Layer.scopedDiscard(make);
}
