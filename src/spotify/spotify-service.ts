import { Console, Effect, Layer, Queue, Option, PubSub, Logger } from "effect";
import { Message, MessagePubSub } from "../message-pubsub";
import { SpotifyApiClient } from "./spotify-api";
import { SpotifyError } from "./spotify-error";

const make = Effect.gen(function* () {
  yield* Effect.logInfo(`Starting SpotifyService`);

  const spotify = yield* SpotifyApiClient;
  const pubsub = yield* MessagePubSub;

  const currentPlayingSubscriber = yield* pubsub.subscribeTo(
    "CurrentlyPlayingRequest",
  );

  const songRequestSubscriber = yield* pubsub.subscribeTo("SongRequest");

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        const message = yield* Queue.take(currentPlayingSubscriber);

        yield* Effect.logInfo(
          `Received a CurrentlyPlayingRequestMessage from @${message.requesterDisplayName}`,
        );

        const { item } = yield* spotify
          .use((client) => client.player.getCurrentlyPlayingTrack())
          .pipe(
            Effect.tapError((error) =>
              Effect.gen(function* () {
                yield* Effect.logError(
                  `An error occured while getting the currently playing track: ${String(error.cause)}`,
                );

                yield* pubsub.publish(
                  Message.SongRequestError({
                    requesterDisplayName: message.requesterDisplayName,
                    cause: error,
                  }),
                );
              }),
            ),
          );

        yield* Effect.logInfo(
          `Successfully fetched currently playing track: ${item.uri}`,
        );

        if (!("album" in item)) {
          yield* Effect.logWarning(
            `The currently playing item is not a song: ${item.uri}`,
          );

          yield* pubsub.publish(
            Message.InvalidSongRequest({
              requesterDisplayName: message.requesterDisplayName,
              reason: "The currently playing item is not a song",
            }),
          );

          return;
        }

        yield* pubsub.publish(
          Message.CurrentlyPlaying({
            song: item.name,
            artists: item.artists.map((artist) => artist.name),
            requesterDisplayName: message.requesterDisplayName,
          }),
        );
      }),
    ),
  ).pipe(
    Effect.annotateLogs({ fiber_name: "spotify-currently-playing-fiber" }),
  );

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        const message = yield* Queue.take(songRequestSubscriber);

        const songId = yield* getSongIdFromUrl(message.url).pipe(
          Effect.tapError((error) =>
            Effect.logError(`getSongIdFromUrl: ${error.cause}`),
          ),
        );

        yield* spotify
          .use((client) =>
            client.player.addItemToPlaybackQueue(`spotify:track:${songId}`),
          )
          .pipe(
            Effect.tapError((error) =>
              Effect.logError(
                `client.player.addItemToPlaybackQueue: ${error.cause}`,
              ),
            ),
          );
      }),
    ),
  );

  yield* Effect.acquireRelease(Effect.logInfo(`SpotifyService started`), () =>
    Effect.logInfo(`SpotifyService stopped`),
  );
}).pipe(Effect.annotateLogs({ fiber_name: "spotify-service" }));

export const SpotifyService = Layer.scopedDiscard(make).pipe(
  Layer.provide(SpotifyApiClient.Live),
);

const songIdRegex = new RegExp(/\/track\/([a-zA-z0-9]*)/);

export function getSongIdFromUrl(
  url: string,
): Effect.Effect<string, SpotifyError> {
  return Option.fromNullable(songIdRegex.exec(url)).pipe(
    Option.map(([, songId]) => songId),
    Effect.mapError(
      () => new SpotifyError({ cause: `Invalid song url: ${url}` }),
    ),
  );
}
