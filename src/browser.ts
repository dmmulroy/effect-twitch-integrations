import { $ } from "bun";
import { Effect } from "effect";

export const Browser = {
  open: (uri: URL) => {
    return Effect.tryPromise({
      try: async () => $`open ${uri.toString()}`,
      catch: (error) =>
        new Error(
          `An error occured while trying to open the browser: ${error}`,
        ),
    });
  },
} as const;
