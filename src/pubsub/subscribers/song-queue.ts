import { Effect, Layer, Queue, Option, Array, pipe } from "effect";
import { PubSubClient } from "../client";
import { TwitchApiClient } from "../../twitch/api";
import { TwitchConfig } from "../../twitch/config";
import type { Track } from "@spotify/web-api-ts-sdk";

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

        const chatMessage = pipe(
          queue,
          Array.filterMap((item) => {
            if ("album" in item.track) {
              return Option.some({ ...item, track: item.track });
            }
            return Option.none();
          }),
          Array.take(4),
          Array.map(formatMessage),
          Array.join(" | "),
        );

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

function formatMessage(
  item: Readonly<{
    track: Track;
    requesterDisplayName: Option.Option<string>;
  }>,
  idx: number,
) {
  const prefix = idx === 0 ? `Currently playing` : `${idx}`;
  const artists = item.track.artists.map((artist) => artist.name).join(", ");
  const requestedBy = Option.map(
    item.requesterDisplayName,
    (name) => ` requested by @${name}`,
  ).pipe(Option.getOrElse(() => ""));

  return `${prefix}: ${item.track.name} by ${artists}${requestedBy}`;
}
