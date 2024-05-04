import { Effect, Layer, Queue } from "effect";
import { Message, MessagePubSub } from "../message-pubsub";
import { SpotifyApiClient } from "./spotify-api";

const make = Effect.gen(function* () {
  yield* Effect.logInfo("starting spotify service");
  const spotify = yield* SpotifyApiClient;
  const pubsub = yield* MessagePubSub;

  const currentPlayingSubscriber = yield* pubsub.subscribeTo(
    "CurrentlyPlayingRequest",
  );

  const songRequestSubscriber = yield* pubsub.subscribeTo("SongRequest");

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        yield* Queue.take(currentPlayingSubscriber);

        const { item } = yield* spotify.use((client) =>
          client.player.getCurrentlyPlayingTrack(),
        );

        if (!("album" in item)) {
          yield* Effect.logWarning(`Invalid Spotify Track Item`);
          return;
        }

        yield* pubsub.publish(Message.CurrentlyPlaying({ song: item }));
      }),
    ),
  );

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        const message = yield* Queue.take(songRequestSubscriber);

        yield* spotify.use((client) =>
          client.player.addItemToPlaybackQueue(message.uri),
        );
      }),
    ),
  );
});

export const SpotifyService = Layer.scopedDiscard(make).pipe(
  Layer.provide(SpotifyApiClient.Live),
  Layer.provide(MessagePubSub.Live),
);
