import type { PageServerLoad } from './$types';

export type NixTimerState = {
  currentTimerStartTime: number | undefined;
  totalTime: number;
};

export type Data = {
  data: NixTimerState;
};

export const load: PageServerLoad = async ({ fetch, depends }) => {
  const { data }: Data = await fetch(
    'https://twitch-integrations.fly.dev/nix-timer',
  ).then((res) => res.json());

  depends('nix-timer');

  return {
    currentTimerStartTime: data.currentTimerStartTime ?? undefined,
    totalTime: data.totalTime,
  };
};
