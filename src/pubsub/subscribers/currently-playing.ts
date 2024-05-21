import { Effect, Layer, Queue } from "effect";
import { PubSubClient } from "../client";
import { Message } from "../messages";

const make = Effect.gen(function* () {
	const pubsub = yield* PubSubClient;

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
		Effect.catchAllDefect(() =>
			Effect.logInfo("Stopped CurrentlyPlayingSubscriber"),
		),
		Effect.annotateLogs({
			module: "currently-playing-subscriber",
		}),
	);
});

export const CurrentlyPlayingSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubClient.Live),
);
