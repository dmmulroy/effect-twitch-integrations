<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { formatDuration } from 'date-fns';

  let { data } = $props();

  const { totalTime, currentTimerStartTime } = data;

  let isRunning = $derived(currentTimerStartTime !== undefined);
  let duration = $state(
    formatDuration({ seconds: (currentTimerStartTime ?? 0) / 1000 }),
  );

  onMount(() => {
    const revalidateInterval = setInterval(() => {
      invalidate('nix-timer');
    }, 5000);

    const updateDuration = setInterval(() => {
      console.log(data);
      if (isRunning) {
        duration = formatDuration({
          seconds: (currentTimerStartTime ?? 0) / 1000,
        });
      }
    });

    return () => {
      clearInterval(revalidateInterval);
      clearInterval(updateDuration);
    };
  });
</script>

<div
  class="mx-auto mt-5 flex h-[120px] w-80 flex-row items-center rounded-md bg-[#24273a] p-2 text-[#cad3f5] shadow-lg"
>
  <div class="flex flex-col">
    <h1>
      Time spent configuring Nix
      <span>{totalTime}</span>
      <span>
        {#if isRunning}
          Running timer: {duration}
        {:else}
          bar
        {/if}
      </span>
    </h1>
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
    class="h-8 w-8 text-pink-400"
  >
    <line x1="2" x2="22" y1="12" y2="12"></line>
    <line x1="12" x2="12" y1="2" y2="22"></line>
    <path d="m20 16-4-4 4-4"></path>
    <path d="m4 8 4 4-4 4"></path>
    <path d="m16 4-4 4-4-4"></path>
    <path d="m8 20 4-4 4 4"></path>
  </svg>
</div>
