import { Effect, Layer, Queue, Random } from "effect";
import { PubSubClient } from "../client";
import { Message } from "../messages";

const make = Effect.gen(function* () {
  yield* Effect.logInfo("Starting KeyboardRaffleSubscriber");

  const pubsub = yield* PubSubClient;

  const subscriber = yield* pubsub.subscribeTo("KeyboardRaffleRequest");

  yield* Effect.forkScoped(
    Effect.forever(
      Effect.gen(function* () {
        const { requesterDisplayName } = yield* Queue.take(subscriber);

        const winningNumber = yield* Random.nextIntBetween(1, 10_000);
        const rolledNumber = yield* Random.nextIntBetween(1, 10_000);

        if (winningNumber === rolledNumber) {
          const message = `@${requesterDisplayName} won 🎉 The winning number was ${winningNumber} and they rolled it!`;
          yield* Effect.logInfo(message);
          yield* pubsub.publish(Message.SendTwitchChat({ message }));
          return;
        }

        const message = `@${requesterDisplayName} lost 😭 The winning number was ${winningNumber} and they rolled ${rolledNumber}`;
        yield* Effect.logInfo(message);
        yield* pubsub.publish(Message.SendTwitchChat({ message }));
      }).pipe(Effect.catchAll(() => Effect.void)),
    ),
  ).pipe(
    Effect.catchAllDefect(() =>
      Effect.logInfo("Stopped KeyboardRaffleSubscriber"),
    ),
  );

  yield* Effect.logInfo("KeyboardRaffleSubscriber started");
}).pipe(
  Effect.annotateLogs({
    module: "keyboard-raffle-subscriber",
  }),
);

export const KeyboardRaffleSubscriber = Layer.scopedDiscard(make).pipe(
  Layer.provide(PubSubClient.Live),
);
