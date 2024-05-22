import { Effect, Layer, Queue, Option, Array, pipe } from "effect";
import { PubSubClient } from "../client";
import { TwitchApiClient } from "../../twitch/api";
import { TwitchConfig } from "../../twitch/config";

const make = Effect.gen(function* () {
  yield* Effect.logInfo("Starting SongQueueSubscriber");

  const api = yield* TwitchApiClient;
  const config = yield* TwitchConfig;
  const pubsub = yield* PubSubClient;

  const subscriber = yield* pubsub.subscribeTo("SongQueue");

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        const { queue } = yield* Queue.take(subscriber);

        const nextThreeSongs = pipe(
          queue,
          Array.filterMap((item) => {
            if ("album" in item.track) {
              return Option.some({ ...item, track: item.track });
            }
            return Option.none();
          }),
          Array.take(3),
        );

        // Start here on Thursday: Fix this so the first item is Currently playing
        const chatMessage = `Song queue: ${nextThreeSongs
          .map(
            (item, idx) =>
              `${idx + 1}: ${item.track.name} by ${item.track.artists
                .map((artist) => artist.name)
                .join(
                  ", ",
                )}${Option.map(item.requesterDisplayName, (name) => ` requested by @${name}`).pipe(Option.getOrElse(() => ""))}`,
          )
          .join(" | ")}`;

        yield* api
          .use((client) =>
            client.chat.sendChatMessage(config.broadcasterId, chatMessage),
          )
          .pipe(Effect.tapError(Effect.logError));
      }).pipe(Effect.catchAll(() => Effect.void)),
    ),
  ).pipe(
    Effect.catchAllDefect(() => Effect.logInfo("Stopped SongQueueSubscriber")),
  );

  yield* Effect.logInfo("SongQueueSubscriber started");
}).pipe(
  Effect.annotateLogs({
    module: "song-queue-subscriber",
  }),
);

export const SongQueueSubscriber = Layer.scopedDiscard(make).pipe(
  Layer.provide(PubSubClient.Live),
  Layer.provide(TwitchApiClient.Live),
);
