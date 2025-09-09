<script lang="ts">
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { createClip } from '$lib/clip/actions';
	//import { createVideoSource } from '$lib/source/actions';

	import TextIcon from '../icons/TextIcon.svelte';
	import AudioIcon from '../icons/AudioIcon.svelte';
	import FilmIcon from '../icons/FilmIcon.svelte';
	import PaletteIcon from '../icons/PaletteIcon.svelte';
	import FolderIcon from '../icons/FolderIcon.svelte';
	import MyTooltip from '../ui/Tooltip.svelte';
	import { Tooltip } from 'bits-ui';

	/* 	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		const file = files[0];
		console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

		createVideoSource(file);
	}; */
</script>

<Tooltip.Provider delayDuration={1000}>
	<div class="mt-12 ml-16 xl:ml-[calc(100svw/20)] relative">
		<div class="absolute -left-13">
			<div class=" flex flex-col bg-zinc-950 rounded mb-5">
				<MyTooltip
					contentProps={{ side: 'right' }}
					triggerProps={{ onclick: () => (appState.showPalette = true) }}
				>
					{#snippet trigger()}
						<div class="p-2 text-zinc-600 hover:text-zinc-400">
							<PaletteIcon class="w-6 h-6" />
						</div>
					{/snippet}
					command palette
					<span class="ml-1 px-1.5 py-0.5 rounded-sm bg-zinc-350">P</span>
				</MyTooltip>
			</div>
			<div class=" flex flex-col bg-zinc-950 rounded">
				<MyTooltip contentProps={{ side: 'right' }}>
					{#snippet trigger()}
						<div class="p-2 text-zinc-200">
							<FolderIcon class="w-6 h-6" />
						</div>
					{/snippet}
					sources folder
				</MyTooltip>
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
			{/each}
		</div>
	</div>
</Tooltip.Provider>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- <div ondrop={onDrop} ondragover={(e) => e.preventDefault()} class="w-full h-full"></div> -->
