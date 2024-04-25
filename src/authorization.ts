import { $ } from "bun";
import { randomBytes } from "crypto";

const scopes = [
  // "ugc-image-upload",
  // "user-read-playback-state",
  // "user-modify-playback-state",
  // "user-read-currently-playing",
  // "app-remote-control",
  // "streaming",
  // "playlist-read-private",
  // "playlist-read-collaborative",
  // "playlist-modify-private",
  // "playlist-modify-public",
  // "user-follow-modify",
  // "user-follow-read",
  // "user-read-playback-position",
  // "user-top-read",
  // "user-read-recently-played",
  // "user-library-modify",
  // "user-library-read",
  "user-read-email",
  "user-read-private",
];

const csrfToken = "foo"; //randomBytes(256).toString("hex");
const redirect_uri = "http://localhost:3939/spotify";

const searchParams = new URLSearchParams({
  response_type: "code",
  client_id: "63b2a826447a402397cd6abd3ccd95b7",
  // client_id: process.env.SPOTIFY_CLIENT_ID as string,
  scope: "user-read-private",
  redirect_uri,
  state: csrfToken,
  show_dialog: "true",
});

const authorizeUrl = new URL(
  `https://accounts.spotify.com/authorize?${searchParams.toString()}`,
);

await $`open ${authorizeUrl}`;

Bun.serve({
  port: 3939,
  async fetch(req) {
    const url = new URL(req.url);

    switch (url.pathname) {
      case "/ping": {
        return new Response("pong");
      }
      case "/spotify": {
        const code = url.searchParams.get("code") ?? "foobar";

        const response = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            ["Content-Type"]: "application/x-www-form-urlencoded",
            ["Authorization"]: `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64")}`,
          },
          body: new URLSearchParams({
            code,
            grant_type: "authorization_code",
            redirect_uri,
          }).toString(),
        })
          .then((res) => res.json())
          .catch(console.error);

        return new Response(JSON.stringify(response));
      }
      default: {
        return new Response("not found", { status: 404 });
      }
    }
  },
});
