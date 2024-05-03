import { SpotifyApi, type AccessToken } from "@spotify/web-api-ts-sdk";
import { Context, Data, Effect, Encoding, Layer, Queue, Secret } from "effect";
import { Message, MessagePubSub } from "../message-pubsub";
import { SpotifyConfig } from "./spotify-config";

export class SpotifyError extends Data.TaggedError("SpotifyError")<{
  cause: unknown;
}> {}

export type ISpotifyApiClient = Readonly<{
  client: SpotifyApi;
  useApi: <A>(
    fn: (client: SpotifyApi) => Promise<A>,
  ) => Effect.Effect<A, SpotifyError, never>;
}>;

function make() {
  return Effect.gen(function* () {
    const config = yield* SpotifyConfig;

    const client = SpotifyApi.withAccessToken(
      config.clientId,
      config.accessToken,
    );

    const useApi = <A>(fn: (client: SpotifyApi) => Promise<A>) =>
      Effect.tryPromise({
        try: () => fn(client),
        catch: (cause) => new SpotifyError({ cause }),
      });

    return { useApi, client } as const;
  });
}

export class SpotifyApiClient extends Context.Tag("spotify-api-client")<
  SpotifyApiClient,
  ISpotifyApiClient
>() {
  static Live = Layer.effect(this, make()).pipe(
    Layer.provide(SpotifyConfig.Live),
  );
}

export const SpotifyService = Layer.scopedDiscard(
  Effect.gen(function* () {
    yield* Effect.logInfo("starting spotify service");
    const spotify = yield* SpotifyApiClient;
    const pubsub = yield* MessagePubSub;

    const dequeue = yield* pubsub.subscribeTo("CurrentlyPlayingRequest");

    yield* Effect.forkScoped(
      Effect.forever(
        Effect.gen(function* () {
          yield* Effect.logInfo("starting CurrentlyPlayingRequest listener");
          // todo: reccommend takeWhen
          yield* Queue.take(dequeue);
          yield* Effect.logInfo("received CurrentlyPlayingRequest listener");

          const { item } = yield* spotify.useApi((client) =>
            client.player.getCurrentlyPlayingTrack(undefined),
          );

          yield* Effect.logInfo("resolved spotify api request");

          if (!("album" in item)) {
            yield* Effect.logWarning(`Invalid Spotify Track Item`);
            return;
          }

          yield* Effect.logInfo("publishing currently playing");
          yield* pubsub.publish(Message.CurrentlyPlaying({ song: item }));
        }),
      ),
    );
  }),
).pipe(Layer.provide(SpotifyApiClient.Live), Layer.provide(MessagePubSub.Live));

export function requestAccessToken(code: string) {
  return Effect.gen(function* () {
    const config = yield* SpotifyConfig;
    const authorizationHeader = `Basic ${Encoding.encodeBase64(
      `${config.clientId}:${Secret.value(config.clientSecret)}`,
    )}`;

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
  });
}

function encodeFormData(data: object) {
  return Object.keys(data)
    .map(
      // @ts-expect-error
      (key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]),
    )
    .join("&");
}
