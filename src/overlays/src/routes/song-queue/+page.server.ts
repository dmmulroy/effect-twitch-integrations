import type { PageServerLoad } from './$types';
import type { Track } from '@spotify/web-api-ts-sdk';
import { Option } from 'effect';

export type QueueItem = Readonly<{
  track: Track;
  requesterDisplayName: Option.Option<string>;
}>;

export type Data = {
  data: ReadonlyArray<QueueItem>;
};

export const load: PageServerLoad = async ({ fetch, depends }) => {
  const { data }: Data = await fetch(
    'https://twitch-integrations.fly.dev/song-queue',
  ).then((res) => res.json());

  const currentlyPlaying = data.at(0);
  const nextUp = data.at(1);

  depends('song-queue');

  return {
    currentlyPlaying,
    nextUp,
  };
};
