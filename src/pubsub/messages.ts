import type { Queue as SpotifyQueue } from "@spotify/web-api-ts-sdk";
import { Data, Types } from "effect";

export type Message = Data.TaggedEnum<{
	CurrentlyPlaying: {
		song: string;
		artists: ReadonlyArray<string>;
		requesterDisplayName: string;
	};
	CurrentlyPlayingRequest: { requesterDisplayName: string };
	SendTwitchChat: { message: string };
	SongRequest: { requesterDisplayName: string; url: string };
	SongQueueRequest: {};
	SongQueue: { queue: SpotifyQueue };
}>;

export const Message = Data.taggedEnum<Message>();

export type MessageType = Types.Tags<Message>;

type ExtractMessage<T extends MessageType> = Types.ExtractTag<Message, T>;

export type CurrentlyPlayingRequestMessage =
	ExtractMessage<"CurrentlyPlayingRequest">;

export type CurrentlyPlayingMessage = ExtractMessage<"CurrentlyPlaying">;

export type SendTwitchChatMessage = ExtractMessage<"SendTwitchChat">;

export type SongRequestMessage = ExtractMessage<"SongRequest">;

export type SongQueueRequestMessage = ExtractMessage<"SongQueueRequest">;

export type SongQueueMessage = ExtractMessage<"SongQueue">;

export type MessageTypeToMessage = {
	CurrentlyPlayingRequest: CurrentlyPlayingRequestMessage;
	CurrentlyPlaying: CurrentlyPlayingMessage;
	SendTwitchChat: SendTwitchChatMessage;
	SongRequest: SongRequestMessage;
	SongQueueRequest: SongQueueRequestMessage;
	SongQueue: SongQueueMessage;
};
