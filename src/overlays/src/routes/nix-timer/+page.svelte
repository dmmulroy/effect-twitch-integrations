<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { intervalToDuration, formatDuration } from 'date-fns';

  let { data } = $props();

  $effect(() => console.log(data));

  let isRunning = $derived(data.currentStartTime !== undefined);

  let duration = $state(
    data.currentStartTime
      ? formatDuration(
          intervalToDuration({ start: data.currentStartTime, end: Date.now() }),
          {
            zero: true,
            delimiter: ':',
            locale: {
              formatDistance: (_token, count) => String(count).padStart(2, '0'),
            },
          },
        )
      : undefined,
  );

  onMount(() => {
    const revalidateInterval = setInterval(() => {
      invalidate('nix-timer');
    }, 5000);

    const updateDuration = setInterval(() => {
      if (isRunning) {
        console.log('duration: ', duration);
        duration = data.currentStartTime
          ? formatDuration(
              intervalToDuration({
                start: data.currentStartTime,
                end: Date.now(),
              }),
              {
                zero: true,
                delimiter: ':',
                locale: {
                  formatDistance: (_token, count) =>
                    String(count).padStart(2, '0'),
                },
              },
            )
          : undefined;
      }
    }, 1000);

    return () => {
      clearInterval(revalidateInterval);
      clearInterval(updateDuration);
    };
  });
</script>

<div
  class="mx-auto mt-5 flex h-[120px] w-80 flex-row items-center justify-between gap-4 rounded-md bg-[#24273a] p-2 p-2 text-[#cad3f5] shadow-lg"
>
  <div class="flex flex-col gap-2">
    <h1>Time spent configuring Nix</h1>
    <span class="text-2xl font-bold">{data.totalTime}</span>
    <span class="text-sm text-gray-300">
      {#if isRunning}
        Running timer: <span class="font-semibold">{duration}</span>
      {:else}
        The timer is not currently running
      {/if}
    </span>
  </div>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    color="#67E8F9"
    fill="none"
    stroke="#67E8F9"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="h-10 w-10"
  >
    <line x1="2" x2="22" y1="12" y2="12"></line>
    <line x1="12" x2="12" y1="2" y2="22"></line>
    <path d="m20 16-4-4 4-4"></path>
    <path d="m4 8 4 4-4 4"></path>
    <path d="m16 4-4 4-4-4"></path>
    <path d="m8 20 4-4 4 4"></path>
  </svg>
</div>
