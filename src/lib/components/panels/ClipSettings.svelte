<script lang="ts">
	import { timelineState } from '$lib/state.svelte';
</script>

{#each timelineState.clips as clip}
	{#if clip.id === timelineState.selectedClip?.id}
		<span class="text-white">{clip.id} ({clip.source.id})</span>
	{/if}
{/each}
