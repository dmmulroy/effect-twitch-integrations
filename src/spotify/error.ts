import { Data } from "effect";

export class SpotifyError extends Data.TaggedError("SpotifyError")<{
  cause: unknown;
}> {}

export class SpotifyApiClientInstantiationError extends Data.TaggedError(
  "SpotifyApiClientInstantiationError",
)<{
  cause: unknown;
}> {}
