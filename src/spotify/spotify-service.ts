import { Effect, Layer, Queue } from "effect";
import { Message, MessagePubSub } from "../message-pubsub";
import { SpotifyApiClient } from "./spotify-api";

export const SpotifyService = Layer.scopedDiscard(make()).pipe(
  Layer.provide(SpotifyApiClient.Live),
  Layer.provide(MessagePubSub.Live),
);

function make() {
  return Effect.gen(function* () {
    yield* Effect.logInfo("starting spotify service");
    const spotify = yield* SpotifyApiClient;
    const pubsub = yield* MessagePubSub;

    const dequeue = yield* pubsub.subscribeTo("CurrentlyPlayingRequest");

    yield* Effect.forkScoped(
      Effect.forever(
        Effect.gen(function* () {
          yield* Effect.logInfo("starting CurrentlyPlayingRequest listener");
          // todo: reccommend takeWhen
          yield* Queue.take(dequeue);
          yield* Effect.logInfo("received CurrentlyPlayingRequest listener");

          const { item } = yield* spotify.use((client) =>
            client.player.getCurrentlyPlayingTrack(undefined),
          );

          yield* Effect.logInfo("resolved spotify api request");

          if (!("album" in item)) {
            yield* Effect.logWarning(`Invalid Spotify Track Item`);
            return;
          }

          yield* Effect.logInfo("publishing currently playing");
          yield* pubsub.publish(Message.CurrentlyPlaying({ song: item }));
        }),
      ),
    );
  });
}
