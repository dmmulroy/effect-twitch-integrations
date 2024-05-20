import { Effect, Layer, Queue } from "effect";
import { PubSubService } from "../client";
import { SpotifyApiClient } from "../../spotify/api";
import { Message } from "../messages";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SongQueueRequestSubscriber`);

	const spotify = yield* SpotifyApiClient;
	const pubsub = yield* PubSubService;

	const songRequestSubscriber = yield* pubsub.subscribeTo("SongQueueRequest");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* (_) {
				yield* Queue.take(songRequestSubscriber);

				const queue = yield* spotify
					.use((client) => client.player.getUsersQueue())
					.pipe(Effect.tapError(Effect.logError));

				yield* pubsub.publish(Message.SongQueue({ queue }));
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	);

	yield* Effect.acquireRelease(
		Effect.logInfo(`SongQueueRequestSubscriber started`),
		() => Effect.logInfo(`SongQueueRequestSubscriber stopped`),
	);
}).pipe(
	Effect.annotateLogs({
		module: "song-queue-request-subscriber",
	}),
);

export const SongQueueRequestSubscriber = Layer.scopedDiscard(make).pipe(
	Layer.provide(PubSubService.Live),
	Layer.provide(SpotifyApiClient.Live),
);
