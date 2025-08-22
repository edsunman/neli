<script lang="ts">
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { createClip } from '$lib/clip/actions';
	//import { createVideoSource } from '$lib/source/actions';

	import TextIcon from '../icons/TextIcon.svelte';
	import TestIcon from '../icons/TestIcon.svelte';
	import AudioIcon from '../icons/AudioIcon.svelte';
	import FilmIcon from '../icons/FilmIcon.svelte';

	/* 	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		const file = files[0];
		console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

		createVideoSource(file);
	}; */
</script>

<div class="mt-12 ml-16 xl:ml-[calc(100svw/20)] relative">
	<div class="absolute -left-13">
		<div class=" flex flex-col bg-zinc-950 rounded">
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<button class="p-2 text-zinc-200">
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
		</div>
	</div>
	<div class="text-zinc-500 text-sm w-full block border-separate border-spacing-y-1">
		{#each appState.sources as source}
			<button
				draggable="true"
				class={[
					'group h-14 pl-20 select-none text-left relative',
					'hover:bg-hover w-full hover:text-zinc-300 rounded-lg '
				]}
				onclick={() => {
					createClip(source.id, 0, timelineState.currentFrame);
					historyManager.finishCommand();
				}}
				ondragstart={(e) => {
					appState.dragAndDropSourceId = source.id;
					if (!e.dataTransfer) return;
					const el = document.createElement('div');
					e.dataTransfer.setDragImage(el, 0, 0);
				}}
			>
				<span
					style:background-image={`url(${source.thumbnail})`}
					class={[
						source.type === 'text' ? 'bg-clip-purple-500' : '',
						source.type === 'test' ? 'bg-clip-green-500' : '',
						source.type === 'audio' ? 'bg-clip-blue-500' : '',
						'h-10 w-14 flex flex-wrap justify-center content-center top-2 left-2 absolute',
						'rounded-lg opacity-60 group-hover:opacity-100 transition-opacity bg-cover bg-center'
					]}
				>
					{#if source.type === 'text'}
						<TextIcon class="size-6 text-clip-purple-600" />
					{:else if source.type === 'test'}
						<FilmIcon class="size-6 text-clip-green-600" />
					{:else if source.type === 'audio'}
						<AudioIcon class="size-6 text-clip-blue-600" />
					{/if}
				</span>

				{source.name}
			</button>
			<!-- 	<span class="text-white">{source.name}</span>
	<button class="text-white" onclick={() => createClip(source.id)}>add</button>
	<br /> -->
		{/each}
	</div>
</div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- <div ondrop={onDrop} ondragover={(e) => e.preventDefault()} class="w-full h-full"></div> -->
