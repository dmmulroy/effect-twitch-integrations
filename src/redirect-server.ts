import { type Server } from "bun";
import { Context, Deferred, Effect, Layer, Option, Function } from "effect";

export type RedirectServerOptions = Readonly<{
  clientId: string;
  clientSecret: string;
  csrfToken: string;
  port: number;
  redirectUri: string;
}>;

export type StartServer = () => Effect.Effect<Server>;

export type RedirectServer = Readonly<{
  mailbox: Deferred.Deferred<string, Error>;
  start: () => Effect.Effect<RedirectServer, Error>;
  stop: () => Effect.Effect<void, Error>;
}>;

function make(options: RedirectServerOptions): Effect.Effect<RedirectServer> {
  return Effect.gen(function* () {
    const mailbox = yield* Deferred.make<string, Error>();
    const router = makeRouter(mailbox, options);

    return {
      mailbox,
      start: () => {
        const server = Bun.serve({
          port: options.port,
          fetch: router,
        });
        return Effect.succeed({
          mailbox,
          start: () =>
            Effect.fail(new Error("RedirectServer is already running")),
          stop: () => Effect.succeed(server.stop()),
        });
      },
      stop: () => Effect.fail(new Error("RedirectServer is not running")),
    };
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

function makeRouter(
  mailbox: Deferred.Deferred<string, Error>,
  _options: RedirectServerOptions,
) {
  return function router(req: Request) {
    return Effect.gen(function* () {
      const url = new URL(req.url);

      switch (url.pathname) {
        case "/ping": {
          return new Response("pong");
        }
        case "/spotify": {
          return yield* Effect.all({
            code: Option.fromNullable(url.searchParams.get("code")).pipe(
              Effect.mapError(Function.constant(new Error("No code received"))),
            ),
            state: Option.fromNullable(url.searchParams.get("state")).pipe(
              Effect.mapError(
                Function.constant(new Error("No state received")),
              ),
            ),
          })
            .pipe(
              Effect.match({
                onSuccess: (params) => {
                  return Effect.gen(function* () {
                    yield* Deferred.succeed(mailbox, params.code);

                    return new Response("success", { status: 200 });
                  });
                },
                onFailure: (error) => {
                  return Effect.gen(function* () {
                    yield* Deferred.fail(mailbox, error);

                    return new Response(`bad request: ${error.message}`, {
                      status: 400,
                    });
                  });
                },
              }),
            )
            .pipe(Effect.runSync);
        }
        default: {
          yield* Deferred.fail(mailbox, new Error("not found"));
          return new Response("not found", { status: 404 });
        }
      }
    }).pipe(Effect.runPromise);
  };
}
