import { randomBytes } from "crypto";
import {
  Context,
  Deferred,
  Effect,
  Layer,
  Option,
  Function,
  Secret,
  Console,
} from "effect";
import { SpotifyConfigService } from "./spotify-config-service";
import { Browser } from "./browser";

export type RedirectServerOptions = Readonly<{
  clientId: string;
  clientSecret: string;
  csrfToken: string;
  port: number;
  redirectServerPath: string;
}>;

export type IRedirectServer = Readonly<{
  getMailbox: () => Effect.Effect<Deferred.Deferred<string, Error>, Error>;
  getCsrfToken: () => string;
}>;

export class RedirectServer extends Context.Tag("redirect-server")<
  RedirectServer,
  IRedirectServer
>() {
  static Live = Layer.scoped(
    RedirectServer,
    Effect.flatMap(SpotifyConfigService, (config) => {
      return Effect.gen(function* () {
        const mailbox = yield* Deferred.make<string, Error>();
        const csrfToken = randomBytes(256).toString("hex");

        yield* Effect.acquireRelease(
          Effect.succeed(
            Bun.serve({
              port: config.port,
              fetch: makeRouter(mailbox, {
                clientId: config.clientId,
                clientSecret: Secret.value(config.clientSecret),
                csrfToken,
                port: config.port,
                redirectServerPath: config.redirectServerPath,
              }),
            }),
          ),
          (server) => {
            console.log("stopping bun http server");
            return Effect.succeed(server.stop());
          },
        );

        return RedirectServer.of({
          getCsrfToken() {
            return csrfToken;
          },
          getMailbox() {
            return Effect.flatMap(Deferred.isDone(mailbox), (isDone) => {
              if (isDone) {
                return Effect.fail(new Error("Mailbox has already been read"));
              }

              return Effect.succeed(mailbox);
            });
          },
        });
      });
    }),
  ).pipe(Layer.provide(SpotifyConfigService.Live));
}

function makeRouter(
  mailbox: Deferred.Deferred<string, Error>,
  options: RedirectServerOptions,
) {
  return function router(req: Request) {
    return Effect.gen(function* () {
      const url = new URL(req.url);

      switch (url.pathname) {
        case "/ping": {
          return new Response("pong");
        }
        case `/${options.redirectServerPath}`: {
          return yield* Effect.all({
            code: Option.fromNullable(url.searchParams.get("code")).pipe(
              Effect.mapError(Function.constant(new Error("No code received"))),
            ),
            // TODO: Validate that state matches the csrfToken
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

// btw, design pill: your "program" can be "Layer.discardEffect(program)" and your main function can be "Layer.launch(fullLayer)" this automatically puts a never so you don't have to
const MainLive = Layer.merge(SpotifyConfigService.Live, RedirectServer.Live);

export const program = Effect.gen(function* () {
  const redirectServer = yield* RedirectServer;
  const config = yield* SpotifyConfigService;

  const mailbox = yield* redirectServer.getMailbox();

  const searchParams = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: "user-read-private",
    redirect_uri: `http://localhost:${config.port}/${config.redirectServerPath}`,
    state: "foo",
    show_dialog: "true",
  });

  const authorizeUrl = new URL(
    `https://accounts.spotify.com/authorize?${searchParams.toString()}`,
  );

  yield* Browser.open(authorizeUrl);
  yield* Deferred.await(mailbox).pipe(Effect.tap(Console.log));

  // run forever
  return yield* Effect.never;
}).pipe(Effect.provide(MainLive));
