import {
  Array,
  Context,
  Data,
  Effect,
  Layer,
  Option,
  Queue,
  Schedule,
  SynchronizedRef,
} from "effect";
import type { TrackItem } from "@spotify/web-api-ts-sdk";
import { FileSystem } from "@effect/platform";
import { PubSubClient } from "../pubsub/client";
import type { SongAddedToSpotifyQueueMessage } from "../pubsub/messages";
import { SpotifyApiClient, type ISpotifyApiClient } from "../spotify/api";
import type { SpotifyError } from "../spotify/error";
import { BunFileSystem } from "@effect/platform-bun";

export type QueueItem = Readonly<{
  track: TrackItem;
  requesterDisplayName: Option.Option<string>;
}>;

type ISongQueue = Readonly<{
  getQueue: () => Effect.Effect<
    ReadonlyArray<QueueItem>,
    SpotifyError | PersistSongQueueError
  >;
}>;

const make = Effect.gen(function* (_) {
  yield* Effect.logInfo(`Starting SongQueue`);

  const pubsub = yield* PubSubClient;
  const spotify = yield* SpotifyApiClient;
  const fs = yield* FileSystem.FileSystem;

  const subscriber = yield* pubsub.subscribeTo("SongAddedToSpotifyQueue");

  const queueRef = yield* Effect.acquireRelease(
    Effect.gen(function* () {
      const persistedQueue = yield* fs
        .readFileString("src/song-queue/persistence.json")
        .pipe(
          Effect.andThen((json) =>
            Effect.try({
              try: (): ReadonlyArray<QueueItem> => JSON.parse(json),
              catch: (): ReadonlyArray<QueueItem> => {
                return [];
              },
            }),
          ),
        );

      const queueRef =
        yield* SynchronizedRef.make<ReadonlyArray<QueueItem>>(persistedQueue);

      yield* Effect.logInfo("SongQueue started");

      return queueRef;
    }),
    (queueRef) => {
      return Effect.gen(function* () {
        const queue = yield* SynchronizedRef.get(queueRef);

        yield* fs
          .writeFileString(
            "src/song-queue/persistence.json",
            JSON.stringify(queue, null, 2),
          )
          .pipe(
            Effect.tapError(Effect.logError),
            Effect.catchAll((_) => Effect.void),
          );

        yield* Effect.logInfo("SongQueue stopped");
      });
    },
  );

  const internalSyncQueue = makeSyncQueue(spotify, fs);

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

  yield* Effect.forkScoped(
    Effect.repeat(syncQueue(undefined), Schedule.fixed("5 seconds")),
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
    Layer.provide(BunFileSystem.layer),
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

function makeSyncQueue(spotify: ISpotifyApiClient, fs: FileSystem.FileSystem) {
  return function (internalQueue: ReadonlyArray<QueueItem>) {
    return Effect.gen(function* (_) {
      const result = yield* spotify.use((client) =>
        client.player.getUsersQueue(),
      );

      const spotifyQueue = [result.currently_playing, ...result.queue];

      const [updatedInternalQueue] = spotifyQueue.reduce(
        makeQueueReducer(internalQueue),
        [[], []],
      );

      yield* fs
        .writeFileString(
          "src/song-queue/persistence.json",
          JSON.stringify(updatedInternalQueue, null, 2),
        )
        .pipe(Effect.mapError((cause) => new PersistSongQueueError({ cause })));

      return updatedInternalQueue;
    });
  };
}

class PersistSongQueueError extends Data.TaggedError("PersistSongQueueError")<{
  cause: unknown;
}> {}

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
