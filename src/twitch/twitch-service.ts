import { Layer, Effect, Queue, Stream, Chunk } from "effect";
import { TwitchConfig } from "./twitch-config";
import { MessagePubSub } from "../pubsub/message-pubsub";
import { TwitchApiClient } from "./twitch-api";
import { TwitchEventSubClient } from "./twitch-eventsub";
import { TwitchEventSubStream } from "./twitch-eventsub-stream";

export const TwitchServiceRequirementsLive = TwitchEventSubStream.Live.pipe(
  Layer.provideMerge(TwitchConfig.Live),
  Layer.provideMerge(TwitchApiClient.Live),
  Layer.provide(TwitchEventSubClient.Live),
);

export const TwitchClientsTest = TwitchEventSubStream.Live.pipe(
  Layer.provideMerge(TwitchConfig.Live),
  Layer.provideMerge(TwitchApiClient.Live),
  Layer.provide(TwitchEventSubClient.Test),
);

const make = Effect.gen(function* (_) {
  yield* Effect.logInfo(`Starting TwitchService`);

  const api = yield* TwitchApiClient;
  const config = yield* TwitchConfig;
  const pubsub = yield* MessagePubSub;

  const currentlyPlayingSubscriber =
    yield* pubsub.subscribeTo("CurrentlyPlaying");

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* (_) {
        const { song, artists, requesterDisplayName } = yield* Queue.take(
          currentlyPlayingSubscriber,
        );

        const message = `Current song: ${song} by ${artists.join(", ")}`;

        yield* Effect.logInfo(
          `Received a CurrentlyPlayingMessage for @${requesterDisplayName}. ${message}`,
        );

        yield* api
          .use((client) =>
            client.chat.sendChatMessage(config.broadcasterId, message),
          )
          .pipe(Effect.tapError(Effect.logError));

        yield* Effect.logInfo(
          `Successfully sent CurrentlyPlayingMessage to twitch for @${requesterDisplayName}`,
        );
      }),
    ),
  ).pipe(
    Effect.annotateLogs({
      fiber_name: "twitch-service-currently-playing-fiber",
    }),
  );

  yield* Effect.acquireRelease(Effect.logInfo(`TwitchService started`), () =>
    Effect.logInfo(`TwitchService stopped`),
  );
}).pipe(
  Effect.annotateLogs({
    fiber_name: "twitch-service",
  }),
);

export const TwitchService = Layer.scopedDiscard(make).pipe(
  Layer.provide(TwitchServiceRequirementsLive),
);
