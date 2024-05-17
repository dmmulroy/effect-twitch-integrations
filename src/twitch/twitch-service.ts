import { Layer, Effect } from "effect";
import { TwitchApiClient } from "./twitch-api";
import { TwitchEventSubSubscribers } from "./twitch-eventsub-subscribers";
import { MessagePubSub } from "../pubsub/message-pubsub";
import { TwitchSendTwitchShatSubscriber } from "./twitch-send-twitch-shat-subscriber";
import { TwitchCurrentlyPlayingSubscriber } from "./twitch-currently-playing-subscriber";
import { TwitchEventSubClient } from "./twitch-eventsub";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting TwitchService`);

	yield* Effect.acquireRelease(Effect.logInfo(`TwitchService started`), () =>
		Effect.logInfo(`TwitchService stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "spotify-service" }));

export const TwitchService = Layer.scopedDiscard(make).pipe(
	Layer.provide(TwitchSendTwitchShatSubscriber.Live),
	Layer.provide(TwitchCurrentlyPlayingSubscriber.Live),
	Layer.provide(TwitchEventSubSubscribers.Live),
	Layer.provide(TwitchEventSubClient.Live),
	Layer.provide(TwitchApiClient.Live),
	Layer.provide(MessagePubSub.Live),
);
