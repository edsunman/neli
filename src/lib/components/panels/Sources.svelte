<script lang="ts">
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { createClip } from '$lib/clip/actions';
	import { Tooltip } from 'bits-ui';

	import TextIcon from '../icons/TextIcon.svelte';
	import AudioIcon from '../icons/AudioIcon.svelte';
	import FilmIcon from '../icons/FilmIcon.svelte';
	import PaletteIcon from '../icons/PaletteIcon.svelte';
	import FolderIcon from '../icons/FolderIcon.svelte';
	import MyTooltip from '../ui/Tooltip.svelte';
	import AddIcon from '../icons/AddIcon.svelte';

	let dragHover = $state(false);
	let fileInput = $state<HTMLInputElement>();

	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		dragHover = false;

		const files = e.dataTransfer?.files;
		if (!files) return;

		fileSelected(files[0]);
	};

	const fileSelected = (file: File) => {
		console.log('selected', file);
		appState.fileToImport = file;
		appState.palettePage = 'import';
		appState.showPalette = true;
	};
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
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class={[
					dragHover ? 'border-zinc-300 text-zinc-200' : 'border-zinc-800 text-zinc-800',
					'rounded-lg border-2  flex-1',
					'border-dashed items-center justify-center flex h-14 mt-2',
					'hover:border-zinc-500 hover:text-zinc-400'
				]}
				ondrop={onDrop}
				ondragenter={() => (dragHover = true)}
				ondragleave={() => (dragHover = false)}
				ondragover={(e) => e.preventDefault()}
				onclick={() => {
					if (!fileInput) return;
					fileInput.click();
				}}
			>
				<AddIcon class="w-6 h-6 pointer-events-none" />
			</div>
			<input
				onclick={(e) => {
					// allow on change to run for same file
					e.currentTarget.value = '';
				}}
				onchange={(e) => {
					if (!e.currentTarget.files || (e.currentTarget.files && e.currentTarget.files.length < 1))
						return;
					const file = e.currentTarget.files[0];
					fileSelected(file);
				}}
				bind:this={fileInput}
				type="file"
				class="hidden"
			/>
		</div>
	</div>
</Tooltip.Provider>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- <div ondrop={onDrop} ondragover={(e) => e.preventDefault()} class="w-full h-full"></div> -->
