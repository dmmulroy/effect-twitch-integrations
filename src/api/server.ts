import { HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { SongQueueClient } from "../song-queue/client";
import { NixTimerClient } from "../nix-timer/client";

const router = HttpServer.router.empty.pipe(
  HttpServer.router.get("/ping", HttpServer.response.text("pong")),
  HttpServer.router.get(
    "/nix-timer",
    Effect.gen(function* () {
      const timer = yield* NixTimerClient;
      const currentStartTime = yield* timer.getCurrentTimerStartTime();
      const totalTime = yield* timer.getTotalTime();
      yield* Effect.log({ currentStartTime, totalTime });
      return yield* HttpServer.response.json(
        { data: { currentStartTime, totalTime } },
        { status: 200 },
      );
    }),
  ),
  HttpServer.router.get(
    "/song-queue",
    Effect.gen(function* () {
      const client = yield* SongQueueClient;
      const queue = yield* client.getQueue();
      return yield* HttpServer.response.json({ data: queue }, { status: 200 });
    }),
  ),
);

const App = router.pipe(
  Effect.annotateLogs({ module: "api-server" }),
  HttpServer.server.serve(HttpServer.middleware.logger),
  HttpServer.server.withLogAddress,
);

const port = 3000;

const Server = BunHttpServer.server.layer({ port });

export const ApiServer = Layer.provide(App, Server);
