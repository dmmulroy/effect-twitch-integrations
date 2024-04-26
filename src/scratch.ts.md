
const Foo = Context.Tag("Foo");

https://github.com/Effect-TS/cluster/blob/main/packages/cluster/src/internal/recipientBehaviour.ts#L62-L133

          // const response: Readonly<{ code: string; state: string }> =
          //   yield* Effect.tryPromise({
          //     try: async () =>
          //       fetch("https://accounts.spotify.com/api/token", {
          //         method: "POST",
          //         headers: {
          //           ["Content-Type"]: "application/x-www-form-urlencoded",
          //           ["Authorization"]: `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64")}`,
          //         },
          //         body: new URLSearchParams({
          //           code,
          //           grant_type: "authorization_code",
          //           redirect_uri: options.redirectUri,
          //         }).toString(),
          //       }).then((res) => res.json()),
          //     catch: (error) => new Error(`TODO: The request failed: ${error}`),
          //   });
