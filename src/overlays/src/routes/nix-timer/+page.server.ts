import type { PageServerLoad } from './$types';

export type NixTimerState = {
  currentStartTime: number | undefined;
  totalTime: number;
};

export type Data = {
  data: NixTimerState;
};

export const load: PageServerLoad = async ({ fetch, depends }) => {
  const { data }: Data = await fetch(
    'https://twitch-integrations.fly.dev/nix-timer',
  ).then((res) => res.json());

  console.log('load fired!')

  depends('nix-timer');

  return {
    currentStartTime: data.currentStartTime ?? undefined,
    totalTime: data.totalTime,
  };
};
