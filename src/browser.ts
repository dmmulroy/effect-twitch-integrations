import { $ } from "bun";
import { Effect } from "effect";

export const Browser = {
  open: (uri: URL) =>
    Effect.promise(() => $`open ${uri.toString()}`).pipe(
      Effect.withSpan("Browser.open", { attributes: { uri: uri.toString() } })
    ),
} as const;
