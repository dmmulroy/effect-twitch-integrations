import { Layer, Effect, Queue, Function, Stream, Take, Chunk } from "effect";
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
  yield* Effect.logInfo("twitch service starting");
  const api = yield* TwitchApiClient;
  const config = yield* TwitchConfig;
  const eventsub = yield* TwitchEventSubClient;
  const pubsub = yield* MessagePubSub;

  const dequeue = yield* pubsub.subscribeTo("CurrentlyPlaying");

  const chatMessageStream = Stream.async<CurrentlyPlayingRequestMessage>(
    (emit) => {
      eventsub.onChannelChatMessage(
        config.broadcasterId,
        config.broadcasterId,
        async (event) => {
          await Effect.logInfo("chat message").pipe(Effect.runPromise);

          if (event.messageText === "!song") {
            console.log("received !song");
            await emit.single(Message.CurrentlyPlayingRequest());
          }
        },
      );
    },
  );

  const songRequestMessageStream = Stream.async<SongRequestMessage>((emit) => {
    eventsub.onChannelRedemptionAddForReward(
      config.broadcasterId,
      config.songRequestRewardId,
      (event) => emit.single(Message.SongRequest({ uri: event.input })),
    );
  });

  const mergedStream = Stream.merge(
    chatMessageStream,
    songRequestMessageStream,
  );

  const messagePull = yield* Stream.toPull(mergedStream);

  yield* Effect.forkScoped(
    Effect.forever(
      messagePull.pipe(
        Effect.tap(Effect.log),
        Effect.flatMap(Chunk.head),
        Effect.flatMap(pubsub.publish),
        Effect.catchAll(Function.constant(Effect.void)),
      ),
    ),
  );

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        yield* Effect.logInfo("waiting for song");

        const { song, artists } = yield* Queue.take(dequeue);

        const message = `The currently playing song is ${song} by ${artists.join(", ")}`;

        yield* api.use((client) =>
          client.chat.sendChatMessage(config.broadcasterId, message),
        );
      }),
    ),
  );
});

export const TwitchService = Layer.scopedDiscard(make).pipe(
  Layer.provide(Layer.mergeAll(TwitchClientsLive)),
);
