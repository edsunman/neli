<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { createClip } from '$lib/clip/actions';
	import { createSource } from '$lib/source/actions';
	import { sendFileToWorker } from '$lib/renderer/actions';

	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		const file = files[0];
		console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

		createSource(file);
	};
</script>

{#each appState.sources as source}
	<span class="text-white">{source.name}</span>
	<button class="text-white" onclick={() => createClip(source.id)}>add</button>
	<br />
{/each}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div ondrop={onDrop} ondragover={(e) => e.preventDefault()} class="w-full h-full"></div>
