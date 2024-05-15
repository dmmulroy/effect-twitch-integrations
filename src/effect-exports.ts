import { Stream as EffectStream } from "effect";

export type Stream<out A, out E = never, out R = never> = EffectStream.Stream<
  A,
  E,
  R
>;

export const Stream = EffectStream;
