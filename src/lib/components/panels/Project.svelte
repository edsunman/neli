<script>
	import { appState } from '$lib/state.svelte';
	import { createClip } from '$lib/timeline/actions';
</script>

Project
{#each appState.sources as source}
	<span class="text-white">{source.id}</span>
	<button class="text-white" onclick={() => createClip(source.id)}>add</button>
	<br />
{/each}

<button onclick={async () => {}}> Encode </button>
