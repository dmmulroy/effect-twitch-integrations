import { Context, Data, Effect, Layer, Queue, Schedule } from "effect";
import { SpotifyApiClient } from "./spotify-service";
import { TwitchApiClient, TwitchService } from "./twitch-service";
import type { PlaybackState, Track, TrackItem } from "@spotify/web-api-ts-sdk";

// type Message =
//   | Readonly<{
//       kind: "currently-playing";
//     }>
//   | Readonly<{
//       kind: "song-request";
//       payload: string; // song uri
//     }>;

export type Message = Data.TaggedEnum<{
  CurrentlyPlaying: {};
  SongRequest: { uri: string };
}>;

export const Message = Data.taggedEnum<Message>();

interface IMessageQueue {
  readonly enqueue: (message: Message) => Effect.Effect<void, Error>;
}

/**
 * We use `forkDaemon` to keep this service alive until the `main` scope is closed
 */
const MessageQueueDaemon = Effect.forkDaemon(
  Effect.forever(
    Effect.gen(function* () {
      /**
       * We moved out the `SpotifyApiClient` and `TwitchService`, otherwise we would have to provide in the nested effect.
       *
       * As for now, I don't know if there is an automatic way to do this in nested effects.
       * 
       * Ideally, we could use the same pattern as `MessageQueueDaemon` for every message and
       * provide via layer every message implementation becoming testable too.
       */
      const spotifyApiClient = yield* SpotifyApiClient;
      const twitchService = yield* TwitchService;
      const queue = yield* QueueImpl;

      const message = yield* Queue.take(queue);

      const _ = yield* Message.$match({
        CurrentlyPlaying: () => Effect.gen(function* () {
          const playing: PlaybackState = yield* Effect.tryPromise(() =>
            spotifyApiClient.player.getCurrentlyPlayingTrack(undefined),
          );
          const item = playing.item;

          if (!("album" in item)) {
            return yield* Effect.fail(new Error("Invalid Item"));
          }

          yield* twitchService.sendMessage(
            `The currently playing song is ${item.name} by ${item.album.artists.map(({ name }) => name).join(", and ")}`,
          );
        }),
        SongRequest: () => Effect.void,
        // Effect.gen(function* () {
        //   yield* twitchService.sendMessage(
        //     `This operation is not currently supported - sorry!`,
        //   );
        // }),
      })(message);
    }),
  ),
)

/**
  * This is not exported because it is only used in the `MessageQueue` so we can provide it as
  * an explicit dependency BUT it will be not used outside of the `MessageQueue`.
  * 
  * @see `MessageQueue.Live`
  */
// Maybe I could find a better name, but you know
class QueueImpl extends Effect.Tag("queue")<QueueImpl, Queue.Queue<Message>>() {
  static Live = Layer.effect(
    this,
    Effect.acquireRelease(
      Queue.unbounded<Message>(),
      (queue) => {
        console.log("shutting down queue");
        return Queue.shutdown(queue);
      },
    )
  )
}

export class MessageQueue extends Context.Tag("message-queue")<
  MessageQueue,
  IMessageQueue
>() {
  /**
   * We provide an effect without a tag because is not needed outside, so the effect output is discarded; this means `the effect's output should not be propagated in the `A` channel`.
   */
  static Live = Layer.effectDiscard(MessageQueueDaemon).pipe(
    /**
     * Thanks to `Layer.provideMerge` we add `this` (`MessageQueue`) to the layer output (`A`)
     * and say "this layer can be used via a tag" when provided.
     * 
     * At the same time we are providing it to `MessageQueueDaemon`.
     */
    Layer.provideMerge(
      Layer.scoped(
        this,
        Effect.map(QueueImpl, (queue) => MessageQueue.of({
          enqueue: (message) => Queue.offer(queue, message)
        }))
      )
    ),
    /**
     * We don't `provideMerge` as we don't need to propagate this service in the `A` channel, exactly like `MessageQueueDaemon`.
     *
     * Because we need it inside the construction of `this`, we are tagging it, `provide`ing it and then skipping it's output in the constructed layer.
     */
    Layer.provide(QueueImpl.Live),
  )
}
