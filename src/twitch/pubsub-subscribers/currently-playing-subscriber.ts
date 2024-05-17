import { Effect, Layer, Queue } from "effect";
import { PubSubService } from "../../pubsub/client";
import { Message } from "../../pubsub/messages";

const make = Effect.gen(function* () {
	const pubsub = yield* PubSubService;

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
			Effect.logInfo("Stopped TwitchSendTwitchShatSubscriber"),
		),
		Effect.annotateLogs({
			module: "twitch-currently-playing-subscriber",
		}),
	);
});

export const TwitchCurrentlyPlayingSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubService.Live),
);
