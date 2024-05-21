import {
	Array,
	Context,
	Effect,
	Either,
	Function,
	Layer,
	Option,
	Queue,
	SynchronizedRef,
	TQueue,
} from "effect";
import { PubSubClient } from "../pubsub/client";
import type { SongAddedToSpotifyQueueMessage } from "../pubsub/messages";
import { SpotifyApiClient } from "../spotify/api";

// We need a way to:
// - Associate a song request (possibly multiple) with a twitch user id
// - We need to keep the requested songs up to date with the spotify player
// such that once a song is played it is removed from the cache
// - The cache should persist through restarts

// Map<SongId, Array<TwitchSongId>>
//
// Ref<CurrentlyPlayingSong

type QueueItem = Readonly<{
	trackId: string;
	requesterDisplayName: Option.Option<string>;
}>;

// Real SpotifyQueue = [1, 2, 3, 4]
//
// Internal Queue  [
//   { trackId: 1, requesterDisplayName: Some("bunabax")},
//   { trackId: 3, requesterDisplayName: Some("mekapilon")},
//]
//
//End result of merging/syncing should be:
// Internal queue [
//   { trackId: 1, requesterDisplayName: Some("bunabax") },
//   { trackId: 2, requesterDisplayName: None },
//   { trackId: 3, requesterDisplayName: Some("mekapilon") },
//   { trackId: 4, requesterDisplayName: None },
// ]

type ISongQueue = Readonly<{
	peek: () => Effect.Effect<Option.Option<QueueItem>>;
	peekN: (
		amount: number,
	) => Effect.Effect<ReadonlyArray<Option.Option<QueueItem>>>;
	peekAll: () => Effect.Effect<ReadonlyArray<Option.Option<QueueItem>>>;
}>;

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SongQueue`);

	const pubsub = yield* PubSubClient;
	const queueRef = yield* SynchronizedRef.make(Array.empty<QueueItem>());

	const subscriber = yield* pubsub.subscribeTo("SongAddedToSpotifyQueue");

	yield* Effect.forkScoped(
		Effect.forever(
			Queue.take(subscriber).pipe(
				Effect.map(messageToQueueItem),
				Effect.tap(Effect.logInfo),
				Effect.tap((item) =>
					SynchronizedRef.update(queueRef, (queue) =>
						Array.append(queue, item),
					),
				),
			),
		),
	);

	yield* Effect.acquireRelease(Effect.logInfo(`SongQueue started`), () =>
		Effect.logInfo(`SongQueue stopped`),
	);

	return {
		peek: () => SynchronizedRef.get(queueRef).pipe(Effect.map(peek)),
		peekN: (number) =>
			SynchronizedRef.get(queueRef).pipe(
				Effect.map((queue) => peekN(queue, number)),
			),
		peekAll: () => SynchronizedRef.get(queueRef).pipe(Effect.map(peekAll)),
	} as const satisfies ISongQueue;
}).pipe(Effect.annotateLogs({ module: "song-queue" }));

export class SongQueue extends Context.Tag("song-queue")<
	SongQueue,
	ISongQueue
>() {
	static Live = Layer.scoped(this, make).pipe(Layer.provide(PubSubClient.Live));
}

function peek<T>(arr: ReadonlyArray<T>): Option.Option<T> {
	return Option.fromNullable(arr.at(0));
}

function peekN<T>(
	arr: ReadonlyArray<T>,
	number: number,
): ReadonlyArray<Option.Option<T>> {
	if (arr.length < number) {
		return arr.map(Option.some);
	}

	const results = [];

	for (let idx = 0; idx <= number; idx++) {
		results.push(Option.fromNullable(arr.at(idx)));
	}

	return results;
}

function peekAll<T>(arr: ReadonlyArray<T>): ReadonlyArray<Option.Option<T>> {
	return peekN(arr, arr.length);
}

function messageToQueueItem(
	message: SongAddedToSpotifyQueueMessage,
): QueueItem {
	return {
		trackId: message.trackId,
		requesterDisplayName: Option.some(message.requesterDisplayName),
	};
}

// TODO: Wednesday start here w/ syncing w/ SynchronizedRef
// There is an edge case where there are orphaned QueueItems in the currentQueue
// This likely means that
// 1. The song already played
// 2. The song was somehow removed from spotify's queue
function syncQueue(queue: ReadonlyArray<QueueItem>) {
	return Effect.gen(function* (_) {
		const spotify = yield* SpotifyApiClient;

		const result = yield* spotify.use((client) =>
			client.player.getUsersQueue(),
		);

		const spotifyQueue = [result.currently_playing, ...result.queue];

		const [updatedQueue] = spotifyQueue.reduce<
			[ReadonlyArray<QueueItem>, ReadonlyArray<QueueItem>]
		>(
			([updatedQueue, currentQueue], track) => {
				if (track === null) {
					return [updatedQueue, currentQueue];
				}
				const firstIdx = Array.findFirstIndex(
					queue,
					(item) => track.id === item.trackId,
				);

				if (Option.isSome(firstIdx)) {
					const item = Array.unsafeGet(queue, firstIdx.value);
					const currentQueue = Array.remove(queue, firstIdx.value);

					return [
						Array.append(updatedQueue, {
							trackId: track.id,
							requesterDisplayName: item.requesterDisplayName,
						}),
						currentQueue,
					];
				}

				return [
					Array.append(updatedQueue, {
						trackId: track.id,
						requesterDisplayName: Option.none(),
					}),
					currentQueue,
				];
			},
			[[], queue],
		);

		return updatedQueue;
	});
}
