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

<table class="text-zinc-500 text-sm p-8 pt-12 w-full block border-spacing-y-3 select-none">
	<tbody>
		{#each { length: 3 } as _}
			<tr class="group">
				<td class="py-2">
					<div
						class="h-8 w-12 bg-amber-300 rounded-sm opacity-80 group-hover:opacity-100 transition-opacity"
					></div>
				</td>
				<td class="pl-3">nameOfVideo.mp4</td>
				<td class="pl-3">16:9</td>
				<td class="pl-4">30fps</td>
			</tr>
		{/each}
		{#each appState.sources as source}
			<tr>
				<td class="py-2"><div class="h-8 w-12 bg-green-300 rounded-sm"></div></td>
				<td class="pl-3">{source.name}</td>
				<td class="pl-3">16:9</td>
				<td class="pl-4">30fps</td>
			</tr>
			<!-- 	<span class="text-white">{source.name}</span>
	<button class="text-white" onclick={() => createClip(source.id)}>add</button>
	<br /> -->
		{/each}
	</tbody>
</table>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div ondrop={onDrop} ondragover={(e) => e.preventDefault()} class="w-full h-full"></div>
