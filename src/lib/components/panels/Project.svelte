<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { createClip } from '$lib/clip/actions';
	import { createVideoSource } from '$lib/source/actions';

	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		const file = files[0];
		console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

		createVideoSource(file);
	};
</script>

<table
	class="text-zinc-500 text-sm pl-[calc(100svw/20)] p-12 w-full block border-spacing-y-3 select-none"
>
	<tbody>
		{#each { length: 3 } as _}
			<tr class="group">
				<td class="py-2 group-hover:bg-zinc-800">
					<div
						class="h-8 w-12 bg-amber-300 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
					></div>
				</td>
				<td class="pl-3 group-hover:text-zinc-300 group-hover:bg-zinc-800">nameOfVideo.mp4</td>
				<td class="pl-4 group-hover:bg-zinc-800"
					><small class="bg-zinc-600 group-hover:bg-zinc-300 text-zinc-900 py-0.5 px-1 rounded-sm"
						>1:00</small
					></td
				>
				<td class="pl-4 group-hover:text-zinc-300 group-hover:bg-zinc-800"><small>16:9</small></td>
				<td class="pl-4 group-hover:text-zinc-300 group-hover:bg-zinc-800"><small>30fps</small></td>
			</tr>
		{/each}
		{#each appState.sources as source}
			<tr class="group" onclick={() => createClip(source.id, timelineState.currentFrame, 500)}>
				<td class="py-2"
					><div
						class="h-8 w-12 bg-green-300 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
					></div></td
				>
				<td class="pl-3 group-hover:text-zinc-300" colspan={source.type === 'text' ? 4 : 1}
					>{source.name}</td
				>
				{#if source.type === 'video'}
					<td class="pl-3">16:9</td>
					<td class="pl-4">30fps</td>
				{/if}
			</tr>
			<!-- 	<span class="text-white">{source.name}</span>
	<button class="text-white" onclick={() => createClip(source.id)}>add</button>
	<br /> -->
		{/each}
	</tbody>
</table>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div ondrop={onDrop} ondragover={(e) => e.preventDefault()} class="w-full h-full"></div>
