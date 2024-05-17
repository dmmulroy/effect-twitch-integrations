import { Effect, Layer } from "effect";
import { MessagePubSub } from "../pubsub/message-pubsub";
import { SpotifyApiClient } from "./spotify-api";
import { SpotifyCurrentlyPlayingRequestSubscriber } from "./spotify-currently-playing-request-subscriber";
import { SpotifySongRequestSubscriber } from "./spotify-song-request-subscriber";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SpotifyService`);

	yield* Effect.acquireRelease(Effect.logInfo(`SpotifyService started`), () =>
		Effect.logInfo(`SpotifyService stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "spotify-service" }));

export const SpotifyService = Layer.scopedDiscard(make).pipe(
	Layer.provide(SpotifyCurrentlyPlayingRequestSubscriber.Live),
	Layer.provide(SpotifySongRequestSubscriber.Live),
	Layer.provide(SpotifyApiClient.Live),
	Layer.provide(MessagePubSub.Live),
);
