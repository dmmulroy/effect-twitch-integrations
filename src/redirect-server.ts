import { type Server } from "bun";
import { Context, Effect, Layer } from "effect";

export type RedirectServerOptions = Readonly<{
  clientId: string;
  clientSecret: string;
  port: number;
  redirectUri: string;
}>;

export type StartServer = () => Effect.Effect<Server>;
// https://github.com/Effect-TS/cluster/blob/main/packages/cluster/src/internal/recipientBehaviour.ts#L62-L133
export type RedirectServer = Readonly<{
  start: () => Effect.Effect<RedirectServer, Error>;
  stop: () => Effect.Effect<void, Error>;
}>;

// const MyNominalSymbol = Symbol();
//
// class MyNominal {
//   readonly _ = MyNominalSymbol;
//   constructor() {}
// }

function make(options: RedirectServerOptions): Effect.Effect<RedirectServer> {
  return Effect.succeed({
    start: () => {
      const server = Bun.serve({
        port: options.port,
        async fetch(req) {
          console.log("Server started!");

          const url = new URL(req.url);

          switch (url.pathname) {
            case "/ping": {
              return new Response("pong");
            }
            case "/spotify": {
              const code = url.searchParams.get("code") ?? "foobar";

              const response = await fetch(
                "https://accounts.spotify.com/api/token",
                {
                  method: "POST",
                  headers: {
                    ["Content-Type"]: "application/x-www-form-urlencoded",
                    ["Authorization"]: `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64")}`,
                  },
                  body: new URLSearchParams({
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: options.redirectUri,
                  }).toString(),
                },
              )
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
      return Effect.succeed({
        start: () =>
          Effect.fail(new Error("RedirectServer is already running")),
        stop: () => Effect.succeed(server.stop()),
      });
    },
    stop: () => Effect.fail(new Error("RedirectServer is not running")),
  });
}

export class RedirectServerService extends Context.Tag("RedirectServer")<
  RedirectServerService,
  Readonly<{
    make: (
      options: RedirectServerOptions,
    ) => Effect.Effect<RedirectServer, Error>;
  }>
>() {}

export const DefaultRedirectServer = Layer.succeed(
  RedirectServerService,
  RedirectServerService.of({
    make,
  }),
);
