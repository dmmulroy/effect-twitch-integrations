<script lang="ts">
  import { Option } from "effect";
  import { onMount } from "svelte";
  import { invalidate } from "$app/navigation";
  export let data;

  let active: "currentlyPlaying" | "nextUp" = "currentlyPlaying";
  let activeData: typeof data.currentlyPlaying;

  $: activeData =
    active === "currentlyPlaying" ? data.currentlyPlaying : data.nextUp;

  onMount(() => {
    const interval = setInterval(() => {
      if (active === "currentlyPlaying") {
        active = "nextUp";
        return;
      }

      active = "currentlyPlaying";
      invalidate("song-queue");
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  });
</script>

<div
  class="mx-auto mt-5 flex w-80 h-[120px] items-center rounded-md bg-[#24273a] p-2 text-[#cad3f5] shadow-lg"
>
  {#if activeData?.track.album.images[0]?.url !== undefined}
    <img
      src={activeData?.track.album.images[0]?.url}
      width="64"
      height="64"
      alt="Album Art"
      class="rounded-full animate-spin-slow"
    />
  {/if}
  <div class="flex-grow">
    <div class="pl-4 mb-2 flex items-center">
      <div class="flex flex-col gap-1">
        {#if activeData !== undefined}
          <h2 class="text-sm font-semibold">
            {active === "currentlyPlaying" ? "Now Playing" : "Next Up"}
          </h2>
        {:else}
          <h2 class="text-sm font-semibold">Nothing is currently playing</h2>
        {/if}
        <p class="text-xs">{activeData?.track.name}</p>
        <p class="text-xs text-[#b8c0e0]">
          {activeData?.track.artists.map(({ name }) => name).join(", ")}
        </p>
        {#if activeData && Option.isSome(activeData.requesterDisplayName)}
          <p class="text-xs text-[#b8c0e0]">
            Requested by @{activeData.requesterDisplayName.value}
          </p>
        {/if}
      </div>
    </div>
  </div>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="text-[#f5bde6] min-h-12 min-w-12 ml-auto"
  >
    <path d="M9 18V5l12-2v13"></path>
    <circle cx="6" cy="18" r="3"></circle>
    <circle cx="18" cy="16" r="3"></circle>
  </svg>
</div>
