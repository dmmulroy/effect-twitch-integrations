import { Context, Effect, Layer, Queue } from "effect";
import { Message, MessagePubSub } from "../pubsub/message-pubsub";

const make = Effect.gen(function* () {
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

				yield* pubsub.publish(Message.SendTwitchChat({ message }));
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	).pipe(
		Effect.annotateLogs({
			module: "twitch-currently-playing-subscriber",
		}),
	);
});

export class TwitchCurrentlyPlayingSubscriber extends Context.Tag(
	"twitch-currently-playing-subscriber",
)<TwitchCurrentlyPlayingSubscriber, never>() {
	static Live = Layer.scopedDiscard(make);
}
