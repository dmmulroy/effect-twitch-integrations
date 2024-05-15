import { Context, Effect, Layer } from "effect";
import {
  Message,
  MessagePubSub,
  type CurrentlyPlayingRequestMessage,
  type SongRequestMessage,
} from "../pubsub/message-pubsub";
import { TwitchConfig } from "./twitch-config";
import { TwitchEventSubClient } from "./twitch-eventsub";
import { Stream } from "../effect-exports";

export type IChatMessageStream = Stream<CurrentlyPlayingRequestMessage>;

const makeChatMessageStream = Effect.gen(function* () {
  const config = yield* TwitchConfig;
  const eventsub = yield* TwitchEventSubClient;

  return Stream.async<CurrentlyPlayingRequestMessage>((emit) => {
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
  });
});

export class ChatMessageStream extends Context.Tag("chat-message-stream")<
  ChatMessageStream,
  IChatMessageStream
>() {
  static Live = Layer.effect(this, makeChatMessageStream);
}

export type ISongRequestMessageStream = Stream<SongRequestMessage>;

const makeSongRequestMessageStream = Effect.gen(function* () {
  const config = yield* TwitchConfig;
  const eventsub = yield* TwitchEventSubClient;

  return Stream.async<SongRequestMessage>((emit) => {
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
});

export class SongRequestMessageStream extends Context.Tag(
  "song-request-message-stream",
)<SongRequestMessageStream, ISongRequestMessageStream>() {
  static Live = Layer.effect(this, makeSongRequestMessageStream);
}

const make = Effect.gen(function* () {
  const chatMessageStream = yield* ChatMessageStream;
  const songRequestMessageStream = yield* SongRequestMessageStream;
  const pubsub = yield* MessagePubSub;

  const eventSubStream = Stream.merge(
    chatMessageStream,
    songRequestMessageStream,
  );

  yield* Effect.forkScoped(
    Stream.runForEach(eventSubStream, (message) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(
          `Received ${message._tag} message from twitch eventsub from @${message.requesterDisplayName}`,
        );

        yield* pubsub.publish(message);
      }),
    ),
  );
});

export class TwitchEventSubStream extends Context.Tag("twitch-eventsub-stream")<
  TwitchEventSubStream,
  never
>() {
  static Live = Layer.scopedDiscard(make).pipe(
    Layer.provide(
      Layer.mergeAll(ChatMessageStream.Live, SongRequestMessageStream.Live),
    ),
  );
}
