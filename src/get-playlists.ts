import { Effect } from "effect";
import type { Jwt } from "./jwt";

export const getLibraryPlaylists = (
  developerToken: string,
  musicUesrToken: string,
) => {
  return Effect.tryPromise({
    try: async (signal) => {
      const data = await fetch(
        "https://api.music.apple.com/v1/me/library/playlists",
        {
          headers: {
            ["Content-Type"]: "application/json",
            Authorization: `Bearer ${developerToken}`,
            ["Music-User-Token"]: musicUesrToken,
          },
          signal,
        },
      ).then((res) => {
        console.log(res.statusText);
        return res.json();
      });

      return data as string;
    },
    catch: (error) => {
      return new Error(
        `An error occured while fetching library playlists: ${error}`,
      );
    },
  });
};
