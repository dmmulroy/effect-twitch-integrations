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

export class MessageQueue extends Context.Tag("message-queue")<
  MessageQueue,
  IMessageQueue
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const spotifyApiClient = yield* SpotifyApiClient;
      const twitchService = yield* TwitchService;

      const queue = yield* Effect.acquireRelease(
        Queue.unbounded<Message>(),
        (queue) => {
          console.log("shutting down queue");
          return Queue.shutdown(queue);
        },
      );

      yield* Effect.forkScoped(
        Effect.forever(
          Effect.gen(function* () {
            const message = yield* Queue.take(queue);

            yield* Message.$match({
              CurrentlyPlaying: () =>
                Effect.gen(function* () {
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
              SongRequest: () =>
                Effect.gen(function* () {
                  yield* twitchService.sendMessage(
                    `This operation is not currently supported - sorry!`,
                  );
                }),
            })(message);

            return yield* Effect.void;
          }),
        ),
      );

      return {
        enqueue: (message) => Queue.offer(queue, message),
      };
    }),
  );
}
