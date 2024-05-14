import { Layer, Effect, Queue, Function, Stream, Chunk } from "effect";
import { TwitchConfig } from "./twitch-config";
import {
  Message,
  MessagePubSub,
  type CurrentlyPlayingRequestMessage,
  type SongRequestMessage,
} from "../message-pubsub";
import { TwitchApiClient } from "./twitch-api";
import { TwitchEventSubClient } from "./twitch-eventsub";

export const TwitchClientsLive = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Live,
);

export const TwitchClientsTest = Layer.mergeAll(
  TwitchConfig.Live,
  TwitchApiClient.Live,
  TwitchEventSubClient.Test,
);

const make = Effect.gen(function* (_) {
  yield* Effect.logInfo(`Starting TwitchService`);

  const api = yield* TwitchApiClient;
  const config = yield* TwitchConfig;
  const eventsub = yield* TwitchEventSubClient;
  const pubsub = yield* MessagePubSub;

  const chatMessageStream = Stream.async<CurrentlyPlayingRequestMessage>(
    (emit) => {
      eventsub.onChannelChatMessage(
        config.broadcasterId,
        config.broadcasterId,
        async (event) => {
          if (event.messageText === "!song") {
            await emit.single(
              Message.CurrentlyPlayingRequest({
                requesterDisplayName: event.chatterDisplayName,
              }),
            );
          }
        },
      );
    },
  );

  const songRequestMessageStream = Stream.async<SongRequestMessage>((emit) => {
    eventsub.onChannelRedemptionAddForReward(
      config.broadcasterId,
      config.songRequestRewardId,
      (event) =>
        emit.single(
          Message.SongRequest({
            requesterDisplayName: event.userDisplayName,
            url: event.input,
          }),
        ),
    );
  });

  const mergedStream = Stream.merge(
    chatMessageStream,
    songRequestMessageStream,
  );

  const messagePull = yield* Stream.toPull(mergedStream);

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        const chunk = yield* messagePull;
        const message = yield* Chunk.head(chunk);

        Effect.logInfo(
          `Received ${message._tag} message from twitch eventsub from @${message.requesterDisplayName}`,
        );

        yield* pubsub.publish(message);
      }),
    ),
  );

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
          .pipe(
            Effect.tapError((error) =>
              Effect.logError(
                `An error occured while sending chat message: ${String(error.cause)}`,
              ),
            ),
          );

        yield* Effect.logInfo(
          `Successfully sent CurrentlyPlayingMessage to twitch for @${requesterDisplayName}`,
        );
      }),
    ),
  );

  yield* Effect.acquireRelease(Effect.logInfo(`TwitchService started`), () =>
    Effect.logInfo(`TwitchService stopped`),
  );
});

export const TwitchService = Layer.scopedDiscard(make).pipe(
  Layer.provide(TwitchClientsLive),
);
