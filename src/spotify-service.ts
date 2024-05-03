import { SpotifyApi, type AccessToken } from "@spotify/web-api-ts-sdk";
import { Context, Effect, Layer, Secret, Encoding, pipe, Queue } from "effect";
import { SpotifyConfigService } from "./spotify-config-service";
import { Message, MessagePubSub } from "./message-pubsub";

export class SpotifyApiClient extends Context.Tag("spotify-api-client")<
  SpotifyApiClient,
  SpotifyApi
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const config = yield* SpotifyConfigService;

      return SpotifyApi.withAccessToken(config.clientId, config.accessToken);
    }),
  ).pipe(Layer.provide(SpotifyConfigService.Live));
}

export const SpotifyService = Layer.effectDiscard(
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.logInfo("starting spotify service");
      const api = yield* SpotifyApiClient;
      const pubsub = yield* MessagePubSub;

      const dequeue = yield* pubsub.subscribeTo("CurrentlyPlayingRequest");

      yield* Effect.forkScoped(
        Effect.forever(
          Effect.gen(function* () {
            yield* Effect.logInfo("starting CurrentlyPlayingRequest listener");
            // todo: reccommend takeWhen
            yield* Queue.take(dequeue);
            yield* Effect.logInfo("received CurrentlyPlayingRequest listener");

            const { item } = yield* Effect.tryPromise(() =>
              api.player.getCurrentlyPlayingTrack(undefined),
            );

            yield* Effect.logInfo("resolved spotify api request");

            if (!("album" in item)) {
              yield* Effect.logWarning(`Invalid Spotify Track Item`);
              return yield* Effect.void;
            }

            yield* Effect.logInfo("publishing currently playing");
            yield* pubsub.publish(Message.CurrentlyPlaying({ song: item }));

            return yield* Effect.void;
          }),
        ),
      );

      return yield* Effect.never;
    }),
  ).pipe(Effect.provide(Layer.mergeAll(SpotifyApiClient.Live))),
);

export function requestAccessToken(code: string) {
  return Effect.gen(function* () {
    const config = yield* SpotifyConfigService;
    const authorizationHeader = `Basic ${Encoding.encodeBase64(`${config.clientId}:${Secret.value(config.clientSecret)}`)}`;

    // TODO: Refactor to platform HttpClient
    const token: AccessToken = yield* Effect.tryPromise({
      try: () =>
        fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            Authorization: authorizationHeader,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: encodeFormData({
            code,
            redirect_uri: `http://localhost:${config.port}/${config.redirectServerPath}`,
            grant_type: "authorization_code",
          }),
        }).then((res) => res.json()),
      catch: (error) => {
        return new Error(
          `An error occured while requesting Spotify Access Token: ${error}`,
        );
      },
    });

    return token;
  }).pipe(Effect.provide(SpotifyConfigService.Live));
}

function encodeFormData(data: object) {
  return Object.keys(data)
    .map(
      // @ts-expect-error
      (key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]),
    )
    .join("&");
}
