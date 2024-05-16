import { Context, Effect, Layer, Queue } from "effect";
import { MessagePubSub } from "../pubsub/message-pubsub";
import { TwitchApiClient } from "./twitch-api";
import { TwitchConfig } from "./twitch-config";

const make = Effect.gen(function* () {
	const api = yield* TwitchApiClient;
	const config = yield* TwitchConfig;
	const pubsub = yield* MessagePubSub;

	const subscriber = yield* pubsub.subscribeTo("SendTwitchChat");

	yield* Effect.forkScoped(
		Effect.forever(
			Effect.gen(function* (_) {
				const { message } = yield* Queue.take(subscriber);

				yield* api
					.use((client) =>
						client.chat.sendChatMessage(config.broadcasterId, message),
					)
					.pipe(Effect.tapError(Effect.logError));
			}).pipe(Effect.catchAll(() => Effect.void)),
		),
	).pipe(
		Effect.annotateLogs({
			module: "twitch-send-twitch-shat-subscriber",
		}),
	);
});

export class TwitchSendTwitchShatSubscriber extends Context.Tag(
	"twitch-send-twitch-shat-subscriber",
)<TwitchSendTwitchShatSubscriber, never>() {
	static Live = Layer.scopedDiscard(make);
}
