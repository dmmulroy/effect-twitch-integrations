import { Effect } from "effect";
import type { Jwt } from "./jwt";

export const getLibraryPlaylists = (token: Jwt) => {
  return Effect.tryPromise({
    try: async (signal) => {
      const data = await fetch(
        "https://api.music.apple.com/v1/me/library/playlists",
        {
          headers: {
            ["Content-Type"]: "application/json",
            Authentication: `Bearer ${token}`,
          },
          signal,
        },
      ).then((res) => res.json());

      return data as string;
    },
    catch: (error) => {
      return new Error(
        `An error occured while fetching library playlists: ${error}`,
      );
    },
  });
};
