import { FileSystem, HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import { Context, Effect, Layer } from "effect";
import { SongQueueClient } from "../song-queue/client";

const router = HttpServer.router.empty.pipe(
  HttpServer.router.get("/ping", HttpServer.response.text("pong")),
  HttpServer.router.get(
    "/song-queue-component",
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const html = yield* fs.readFileString("src/overlays/song-queue.html");
      return yield* HttpServer.response.html(html);
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
