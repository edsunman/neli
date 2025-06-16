<script lang="ts">
	import { timelineState } from '$lib/state.svelte';
</script>

{#each timelineState.clips as clip}
	{#if clip.id === timelineState.selectedClip?.id}
		<div class="flex flex-col bg-zinc-800 m-8 rounded-2xl">
			<span class="text-white">{clip.id} ({clip.source.id})</span>
		</div>
	{/if}
{/each}
