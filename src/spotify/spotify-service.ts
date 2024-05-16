import { Effect, Layer } from "effect";
import { SpotifyApiClient } from "./spotify-api";
import { SpotifyCurrentlyPlayingRequestSubscriber } from "./spotify-currently-playing-request-subscriber";
import { SpotifyConfig } from "./spotify-config";
import { SpotifySongRequestSubscriber } from "./spotify-song-request-subscriber";

const make = Effect.gen(function* () {
	yield* Effect.logInfo(`Starting SpotifyService`);

	yield* Effect.acquireRelease(Effect.logInfo(`SpotifyService started`), () =>
		Effect.logInfo(`SpotifyService stopped`),
	);
}).pipe(Effect.annotateLogs({ module: "spotify-service" }));

const SpotifyServiceRequirementsLive =
	SpotifyCurrentlyPlayingRequestSubscriber.Live.pipe(
		Layer.provide(SpotifySongRequestSubscriber.Live),
		Layer.provide(SpotifyConfig.Live),
		Layer.provideMerge(SpotifyApiClient.Live),
	);

export const SpotifyService = Layer.scopedDiscard(make).pipe(
	Layer.provide(SpotifyServiceRequirementsLive),
);
