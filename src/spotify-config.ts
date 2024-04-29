import { Secret } from "effect";

export type SpotifyConfigServiceDefinition = Readonly<{
  clientId: string;
  clientSecret: Secret.Secret;
}>;

class SpotifyConfigService extends Context.Tag('spotify-config-service')
