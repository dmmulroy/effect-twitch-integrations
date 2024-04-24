import { Brand, Context, Effect, Layer } from "effect";
import {
  sign,
  verify,
  type JwtHeader,
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";

export type SignedJwt = string & Brand.Brand<"SignedJwt">;
export const SignedJwt = Brand.nominal<SignedJwt>();
export type VerifiedJwt = SignedJwt & Brand.Brand<"ValidatedJwt">;
export const VerifiedJwt = Brand.nominal<VerifiedJwt>();
export type Jwt = SignedJwt | VerifiedJwt;

export type SignInput = Readonly<
  Required<Pick<JwtPayload, "iss" | "iat" | "exp"> & Pick<JwtHeader, "kid">> & {
    secret: Secret;
  }
>;

export class JwtService extends Context.Tag("JwtService")<
  JwtService,
  Readonly<{
    sign: (input: SignInput) => Effect.Effect<SignedJwt, Error>;
    verify: (
      token: string,
      secret: string,
    ) => Effect.Effect<VerifiedJwt, Error>;
  }>
>() {}

export const JwtServiceLive = Layer.succeed(
  JwtService,
  JwtService.of({
    sign: (input) => {
      return Effect.try({
        try: () => {
          const payload: JwtPayload = {
            exp: input.exp,
            iat: input.iat,
            iss: input.iss,
          };

          const options: SignOptions = {
            algorithm: "ES256",
            keyid: input.kid,
          };

          return SignedJwt(sign(payload, input.secret, options));
        },
        catch: (unknown) =>
          new Error(
            `An error occured while signign Music Devloper Token: ${unknown}`,
          ),
      });
    },
    verify: (token, secret) => {
      return Effect.try({
        try: () => {
          verify(token, secret);

          return VerifiedJwt(token);
        },
        catch: (unknown) => {
          return new Error(
            `An error occured while verifying the Music Devloper Token: ${unknown}`,
          );
        },
      });
    },
  }),
);
