import {
  Array,
  Context,
  Effect,
  Layer,
  Option,
  Queue,
  SynchronizedRef,
} from "effect";
import { PubSubClient } from "../pubsub/client";
import type { SongAddedToSpotifyQueueMessage } from "../pubsub/messages";
import { SpotifyApiClient, type ISpotifyApiClient } from "../spotify/api";
import type { TrackItem } from "@spotify/web-api-ts-sdk";
import type { SpotifyError } from "../spotify/error";

// We need a way to:
// - Associate a song request (possibly multiple) with a twitch user id
// - We need to keep the requested songs up to date with the spotify player
// such that once a song is played it is removed from the cache
// - The cache should persist through restarts

type QueueItem = Readonly<{
  track: TrackItem;
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
  getQueue: () => Effect.Effect<ReadonlyArray<QueueItem>, SpotifyError>;
}>;

const make = Effect.gen(function* () {
  yield* Effect.logInfo(`Starting SongQueue`);

  const pubsub = yield* PubSubClient;
  const spotify = yield* SpotifyApiClient;
  const queueRef = yield* SynchronizedRef.make<ReadonlyArray<QueueItem>>(
    Array.empty(),
  );

  const subscriber = yield* pubsub.subscribeTo("SongAddedToSpotifyQueue");

  const internalSyncQueue = makeSyncQueue(spotify);

  const syncQueue = <A>(_: A) =>
    Effect.log("Synchronizing Spotify Queue").pipe(
      Effect.andThen(() =>
        SynchronizedRef.updateAndGetEffect(queueRef, internalSyncQueue),
      ),
      Effect.tap(Effect.log("Successfully synchronized Spotify Queue")),
      Effect.tapError((error) =>
        Effect.logError(`Error synchronizing Spotify Queue: ${error.message}`),
      ),
      Effect.annotateLogs({ module: "song-queue-client" }),
    );

  yield* Effect.forkScoped(
    Effect.forever(
      Queue.take(subscriber).pipe(
        Effect.map(messageToQueueItem),
        Effect.tap((item) =>
          SynchronizedRef.update(queueRef, (queue) =>
            Array.append(queue, item),
          ),
        ),
        Effect.tap(syncQueue),
      ),
    ),
  );

  yield* Effect.acquireRelease(Effect.logInfo(`SongQueue started`), () =>
    Effect.logInfo(`SongQueue stopped`),
  );

  return {
    getQueue: () => SynchronizedRef.get(queueRef).pipe(syncQueue),
  } as const satisfies ISongQueue;
}).pipe(Effect.annotateLogs({ module: "song-queue-client" }));

export class SongQueueClient extends Context.Tag("song-queue-client")<
  SongQueueClient,
  ISongQueue
>() {
  static Live = Layer.scoped(this, make).pipe(
    Layer.provide(PubSubClient.Live),
    Layer.provide(SpotifyApiClient.Live),
  );
}

function messageToQueueItem(
  message: SongAddedToSpotifyQueueMessage,
): QueueItem {
  return {
    track: message.track,
    requesterDisplayName: Option.some(message.requesterDisplayName),
  };
}

function makeSyncQueue(spotify: ISpotifyApiClient) {
  return function (queue: ReadonlyArray<QueueItem>) {
    return Effect.gen(function* (_) {
      const result = yield* spotify.use((client) =>
        client.player.getUsersQueue(),
      );

      const spotifyQueue = [result.currently_playing, ...result.queue];

      const [updatedInternalQueue] = spotifyQueue.reduce(
        makeQueueReducer(queue),
        [[], []],
      );

      return updatedInternalQueue;
    });
  };
}

type Accumulator = [
  /** updated queue */
  readonly Readonly<QueueItem>[],
  /** current queue */
  readonly Readonly<QueueItem>[],
];

function makeQueueReducer(queue: ReadonlyArray<QueueItem>) {
  return function reduceQueue(
    [updatedQueue, currentQueue]: Accumulator,
    track: TrackItem | null,
  ): Accumulator {
    if (track === null) {
      return [updatedQueue, currentQueue];
    }
    const firstIdx = Array.findFirstIndex(
      queue,
      (item) => track.id === item.track.id,
    );

    if (Option.isSome(firstIdx)) {
      const item = Array.unsafeGet(queue, firstIdx.value);
      const currentQueue = Array.remove(queue, firstIdx.value);

      return [
        Array.append(updatedQueue, {
          track,
          requesterDisplayName: item.requesterDisplayName,
        }),
        currentQueue,
      ];
    }

    return [
      Array.append(updatedQueue, {
        track,
        requesterDisplayName: Option.none(),
      }),
      currentQueue,
    ];
  };
}
