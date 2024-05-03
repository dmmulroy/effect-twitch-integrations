import { Layer, Effect, Queue } from "effect";
import { TwitchConfig } from "./twitch-config";
import { Message, MessagePubSub } from "../message-pubsub";
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

export const TwitchService = Layer.scopedDiscard(make()).pipe(
  Layer.provide(Layer.mergeAll(TwitchClientsLive)),
);

function make() {
  return Effect.gen(function* (_) {
    yield* Effect.logInfo("twitch service starting");
    const api = yield* TwitchApiClient;
    const config = yield* TwitchConfig;
    const eventsub = yield* TwitchEventSubClient;
    const pubsub = yield* MessagePubSub;

    const dequeue = yield* pubsub.subscribeTo("CurrentlyPlaying");

    eventsub.onChannelBan(config.broadcasterId, async () => {
      await Effect.logInfo("Ban event").pipe(Effect.runPromise);
    });

    eventsub.onChannelChatMessage(
      config.broadcasterId,
      config.broadcasterId,
      async (event) => {
        await Effect.logInfo("chat message").pipe(Effect.runPromise);

        if (event.messageText === "!song") {
          await Effect.runPromise(
            pubsub.publish(Message.CurrentlyPlayingRequest()),
          );
        }
      },
    );

    // eventsub.onChannelRedemptionAddForReward(
    //   config.broadcasterId,
    //   config.songRequestRewardId,
    //   (event) => {
    //     Effect.gen(function* () {
    //       yield* pubsub.publish(Message.SongRequest({ uri: event.input }));
    //     });
    //   },
    // );

    yield* Effect.forkScoped(
      Effect.forever(
        Effect.gen(function* () {
          yield* Effect.logInfo("waiting for song");

          const { song } = yield* Queue.take(dequeue);

          yield* Effect.logInfo("received song");

          yield* api.use((client) =>
            client.chat.sendChatMessage(
              config.broadcasterId,
              `The currently playing song is ${song.name}`,
            ),
          );
        }),
      ),
    );
  });
}
