import { Effect, Layer, Match } from "effect";
import { PubSubClient, type IPubSubService } from "../../pubsub/client";
import { TwitchConfig } from "../config";
import { TwitchEventSubClient } from "../eventsub";
import { Message } from "../../pubsub/messages";

const make = Effect.gen(function* () {
  yield* Effect.logInfo("Starting TwitchEventSubChannelChatMessageSubscriber");

  const config = yield* TwitchConfig;
  const eventsub = yield* TwitchEventSubClient;
  const pubsub = yield* PubSubClient;
  const matchCommand = createMatchCommand(pubsub);

  yield* Effect.acquireRelease(
    Effect.sync(() =>
      eventsub.onChannelChatMessage(
        config.broadcasterId,
        config.broadcasterId,
        (event) => {
          matchCommand({
            requesterDisplayName: event.chatterDisplayName,
            message: event.messageText,
          });
        },
      ),
    ).pipe(
      Effect.tap(
        Effect.log("Started TwitchEventSubChannelChatMessageSubscriber"),
      ),
    ),
    (subscription) =>
      Effect.sync(() => subscription.stop()).pipe(
        Effect.tap(
          Effect.log("Stopped TwitchEventSubChannelChatMessageSubscriber"),
        ),
      ),
  );
}).pipe(
  Effect.annotateLogs({
    module: "twitch-eventsub-channel-chat-message-subscriber",
  }),
);

export const TwitchEventSubChannelChatMessageSubscriber = {
  Live: Layer.scopedDiscard(make).pipe(
    Layer.provide(TwitchEventSubClient.Live),
    Layer.provide(PubSubClient.Live),
  ),

  Test: Layer.scopedDiscard(make).pipe(
    Layer.provide(TwitchEventSubClient.Test),
    Layer.provide(PubSubClient.Live),
  ),
} as const;

function createMatchCommand(pubsub: IPubSubService) {
  return function (input: {
    requesterDisplayName: string;
    message: string;
  }): void {
    Match.value(input).pipe(
      Match.when(
        {
          message: "!song",
        },
        ({ requesterDisplayName }) => {
          pubsub.unsafePublish(
            Message.CurrentlyPlayingRequest({
              requesterDisplayName,
            }),
          );
        },
      ),
      Match.when(
        {
          message: "!queue",
        },
        () => {
          pubsub.unsafePublish(Message.SongQueueRequest());
        },
      ),
      Match.when(
        {
          message: "!nix-timer-start",
          requesterDisplayName: "dmmulroy",
        },
        () => {
          pubsub.unsafePublish(Message.StartNixTimer());
        },
      ),
      Match.when(
        {
          message: "!nix-timer-stop",
          requesterDisplayName: "dmmulroy",
        },
        () => {
          pubsub.unsafePublish(Message.StopNixTimer());
        },
      ),
    );
  };
}
