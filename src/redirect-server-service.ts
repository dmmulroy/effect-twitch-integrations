import { randomBytes } from "crypto";
import {
  Context,
  Deferred,
  Effect,
  Layer,
  Option,
  Function,
  Secret,
} from "effect";
import { SpotifyConfig } from "./spotify/spotify-config";

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
    Effect.flatMap(SpotifyConfig, (config) => {
      return Effect.gen(function* () {
        const mailbox = yield* Deferred.make<string, Error>();
        const csrfToken = "foo"; //randomBytes(256).toString("hex");

        yield* Effect.acquireRelease(
          Effect.sync(() =>
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
            return Effect.sync(() => server.stop());
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
  ).pipe(Layer.provide(SpotifyConfig.Live));
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
          const maybeCode = Option.fromNullable(url.searchParams.get("code"));

          if (Option.isNone(maybeCode)) {
            yield* Deferred.fail(mailbox, new Error(`No code received`));

            return new Response("Bad Request: No code received", {
              status: 400,
            });
          }

          const code = yield* maybeCode;

          const maybeState = Option.fromNullable(url.searchParams.get("state"));

          if (Option.isNone(maybeState)) {
            yield* Deferred.fail(mailbox, new Error(`No state received`));

            return new Response("Bad Request: No state received", {
              status: 400,
            });
          }

          const state = yield* maybeState;

          if (state !== options.csrfToken) {
            yield* Deferred.fail(mailbox, new Error("Invalid state"));

            return new Response("Bad Request: Invalid state", { status: 400 });
          }

          yield* Deferred.succeed(mailbox, code);

          return new Response("success", { status: 200 });
        }
        default: {
          yield* Deferred.fail(mailbox, new Error("not found"));
          return new Response("not found", { status: 404 });
        }
      }
    }).pipe(Effect.runPromise);
  };
}
