import { Data } from "effect";

export class TwitchError extends Data.TaggedError("TwitchError")<{
  cause: unknown;
}> {}
