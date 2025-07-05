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

<div class="pt-12 ml-[calc(100svw/20)] retative">
	<div class="absolute left-[calc(100svw/20-50px)] flex flex-col bg-[#131315] rounded">
		{#each { length: 3 } as _}
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<button class="p-2 text-zinc-600 hover:text-zinc-400">
				<svg
					role="img"
					xmlns="http://www.w3.org/2000/svg"
					width="25px"
					height="25px"
					viewBox="0 0 24 24"
					aria-labelledby="folderIconTitle"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					fill="none"
				>
					<path d="M3 5h6l1 2h11v12H3z" />
				</svg>
			</button>
		{/each}
	</div>
	<table class="text-zinc-500 text-sm w-full block border-separate border-spacing-y-1 select-none">
		<tbody>
			{#each { length: 3 } as _}
				<tr class="group hover:bg-zinc-800">
					<td class="py-2 group-hover:bg-zinc-800 rounded-l pl-2">
						<div class="h-8 w-12 bg-amber-300 rounded-sm opacity-70 group-hover:opacity-100"></div>
					</td>
					<td class="pl-3 group-hover:text-zinc-300">nameOfVideo.mp4</td>
					<td class="pl-4"
						><small class="bg-zinc-600 group-hover:bg-zinc-300 text-zinc-900 py-0.5 px-1 rounded-sm"
							>1:00</small
						></td
					>
					<td class="pl-4 group-hover:text-zinc-300"><small>16:9</small></td>
					<td class="pl-4 group-hover:text-zinc-300 rounded-r pr-2"><small>30fps</small></td>
				</tr>
			{/each}
			{#each appState.sources as source}
				<tr
					class="group hover:bg-zinc-800"
					onclick={() => createClip(source.id, 0, timelineState.currentFrame)}
				>
					<td class="py-2 rounded-l pl-2"
						><div
							class="h-8 w-12 bg-green-300 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
						></div></td
					>
					<td
						class="pl-3 group-hover:text-zinc-300 rounded-r pr-2"
						colspan={source.type === 'text' ? 4 : 1}>{source.name}</td
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
</div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div ondrop={onDrop} ondragover={(e) => e.preventDefault()} class="w-full h-full"></div>
