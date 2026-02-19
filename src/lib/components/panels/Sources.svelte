<script lang="ts">
	import { appState, programState, timelineState } from '$lib/state.svelte';
	import { Tooltip } from 'bits-ui';
	import {
		addIcon,
		audioIcon,
		textIcon,
		paletteIcon,
		filmIcon,
		folderIcon,
		presetsIcon
	} from '../icons/Icons.svelte';

	import MyTooltip from '../ui/Tooltip.svelte';
	import { pause } from '$lib/timeline/actions';
	import type { Source } from '$lib/source/source.svelte';
	import { processFile } from '$lib/source/actions';
	import { showSourceInProgram, showTimelineInProgram } from '$lib/program/actions';

	let dragHover = $state(false);
	let hoverName = $state('');
	let hoverNameIndex = $state(0);
	let showHoverName = $state(false);
	let hoverSelected = $state(false);

	let filteredSources = $derived.by(() => {
		appState.sourceFolders;
		return appState.sources.filter((source) => {
			return source.folderId === appState.selectedSourceFolder;
		});
	});

	const onClick = (source: Source) => {
		//if (cursorMovedEnough) return;
		if (source.preset) return;
		hoverSelected = true;
		showSourceInProgram(source);
		appState.propertiesSection = 'source';

		/* timelineState.selectedClips.clear();
		if (source.type === 'srt') {
			// TODO: tidy this up
			for (const entry of source.srtEntries) {
				const clip = createClip(
					appState.sources[0].id,
					1,
					entry.inPoint,
					entry.outPoint - entry.inPoint
				);
				if (!clip) continue;
				clip.text = entry.text;
				clip.params[3] = -0.75;
				clip.params[6] = 12;
				clip.params[7] = 1.5;
				updateWorkerClip(clip);
			}
			setTrackClipJoins(1);
		} else {
			const trackType = getTrackTypeFromSourceType(source.type);
			const track = getTopTrackOfType(trackType);
			if (track < 1) return;
			const clip = createClip(source.id, track, timelineState.currentFrame);
			if (!clip) return;
			if (clip) timelineState.selectedClip = clip;
			finaliseClip(clip, 'addClip');
			setAllTrackTypes();
		}
		historyManager.finishCommand(); */
	};

	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		dragHover = false;

		const files = e.dataTransfer?.files;
		if (!files) return;

		processFile(files[0]);
	};
</script>

<Tooltip.Provider delayDuration={500}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="mt-5 height-lg:mt-12 ml-16 xl:ml-[calc(100svw/20)] relative">
		<div class="absolute -left-13">
			<div class="bg-zinc-950 rounded flex flex-col mb-5">
				<MyTooltip
					contentProps={{ side: 'right' }}
					triggerProps={{ onclick: () => (appState.showPalette = true) }}
				>
					{#snippet trigger()}
						<div class="p-2 text-zinc-600 hover:text-zinc-400">
							{@render paletteIcon('w-6 h-6')}
						</div>
					{/snippet}
					command palette
					<span class="ml-1 px-1.5 py-0.5 text-xs rounded-sm border border-zinc-400 text-zinc-500"
						>P</span
					>
				</MyTooltip>
			</div>

			<div class=" bg-zinc-950 rounded flex flex-col mb-5">
				<MyTooltip
					contentProps={{ side: 'right' }}
					triggerProps={{
						onclick: () => {
							appState.selectedSourceFolder = 0;
						}
					}}
					>{#snippet trigger()}
						<div
							class={[
								appState.selectedSourceFolder === 0
									? 'text-zinc-200'
									: 'text-zinc-600 hover:text-zinc-400',
								'p-2'
							]}
						>
							{@render presetsIcon('w-6 h-6')}
						</div>
					{/snippet}
					presets
				</MyTooltip>

				{#each appState.sourceFolders as folder}
					<MyTooltip
						contentProps={{ side: 'right' }}
						triggerProps={{
							onclick: () => {
								appState.selectedSourceFolder = folder.id;
							}
						}}
						>{#snippet trigger()}
							<div
								class={[
									appState.selectedSourceFolder === folder.id
										? 'text-zinc-200'
										: 'text-zinc-600 hover:text-zinc-400',
									'p-2'
								]}
							>
								{@render folderIcon('w-6 h-6')}
							</div>
						{/snippet}
						source folder
					</MyTooltip>
				{/each}
			</div>
		</div>

		<div
			style:top={`${hoverNameIndex * 60}px`}
			class={[
				showHoverName ? 'visible' : 'invisible',
				hoverSelected ? 'bg-zinc-700 text-zinc-100' : 'bg-hover text-zinc-300',
				'absolute h-14 ml-20 text-left flex ',
				'items-center z-2 rounded-lg pointer-events-none text-sm pr-3 text-nowrap'
			]}
		>
			{hoverName}
		</div>
		<div class="text-zinc-500 text-sm w-full flex flex-col relative gap-1">
			{#each filteredSources as source, i}
				<!-- svelte-ignore a11y_mouse_events_have_key_events -->
				<button
					onmouseover={() => {
						if (appState.mouseIsDown) return;
						if (source.id === appState.selectedSource?.id) hoverSelected = true;
						showHoverName = true;
						hoverName = source.name ?? '';
						hoverNameIndex = i;
					}}
					onmouseout={() => {
						showHoverName = false;
						hoverSelected = false;
						hoverName = '';
					}}
					class={[
						// selected
						source.id === appState.selectedSource?.id && 'bg-zinc-700 text-zinc-100',
						// hover
						!appState.mouseIsDown &&
							source.id !== appState.selectedSource?.id &&
							'hover:text-zinc-300 hover:bg-hover',
						// dragged
						appState.dragAndDrop.clicked &&
							appState.dragAndDrop.dragFrom === 'sources' &&
							appState.dragAndDrop.source?.id === source.id &&
							'bg-hover',

						'group h-14 lg:w-full pl-20 select-none text-left relative',
						'rounded-lg'
					]}
					onmousedown={(e) => {
						pause();
						appState.mouseIsDown = true;
						appState.dragAndDrop.currentCursor = { x: e.clientX, y: e.clientY };
						appState.dragAndDrop.clicked = true;
						appState.dragAndDrop.dragFrom = 'sources';
						appState.dragAndDrop.source = source;
						programState.selectedClip = null;
						timelineState.selectedClip = null;
						timelineState.selectedClips.clear();
						timelineState.selectedTool = 'pointer';
						timelineState.invalidate = true;
					}}
					onclick={(e) => {
						onClick(source);
						e.currentTarget.blur();
					}}
					onmouseleave={(e) => {
						e.currentTarget.blur();
					}}
				>
					<span
						style:background-image={`url(${source.thumbnail})`}
						class={[
							(source.type === 'video' || source.type === 'image') && !source.thumbnail
								? 'opacity-0'
								: appState.dragAndDrop.active &&
									  appState.dragAndDrop.dragFrom === 'sources' &&
									  appState.dragAndDrop.source?.id === source.id
									? 'opacity-10'
									: 'opacity-80',
							source.type === 'text' || source.type === 'srt' ? 'bg-clip-purple-500' : '',
							source.type === 'test' ? 'bg-clip-green-500' : '',
							source.type === 'audio' ? 'bg-clip-blue-500' : '',
							'h-10 w-14 flex flex-wrap justify-center content-center top-2 left-2 absolute',
							'rounded-lg transition-opacity duration-200 bg-cover bg-center'
						]}
					>
						{#if source.type === 'text'}
							{@render textIcon('w-6 h-6 text-clip-purple-600')}
						{:else if source.type === 'srt'}
							<span class="text-clip-purple-600 text-xl font-extrabold">.srt</span>
						{:else if source.type === 'test'}
							{@render filmIcon('w-6 h-6 text-clip-green-600')}
						{:else if source.type === 'audio'}
							{@render audioIcon('w-6 h-6 text-clip-blue-600')}
						{/if}
					</span>
					<span class="hidden lg:block truncate">{source.name}</span>
				</button>
			{/each}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<button
				class={[
					dragHover
						? 'border-zinc-300 text-zinc-200'
						: appState.sources.length <= 2
							? 'border-zinc-600 text-zinc-500'
							: 'border-zinc-800 text-zinc-800',
					!appState.mouseIsDown && 'hover:border-zinc-500 hover:text-zinc-400',
					'focus:border-zinc-300 focus:text-zinc-200 focus:outline-none',
					'[&:nth-child(n+8)]:hidden height-xl:[&:nth-child(n+8)]:flex rounded-lg border-2 select-none ',
					'border-dashed items-center justify-center flex h-14 mt-2 ml-2'
				]}
				ondrop={onDrop}
				ondragenter={() => {
					dragHover = true;
				}}
				ondragleave={() => {
					dragHover = false;
				}}
				ondragover={(e) => e.preventDefault()}
				onclick={() => {
					appState.import.importStarted = false;
					appState.palettePage = 'import';
					appState.showPalette = true;
				}}
			>
				{@render addIcon('size-5 mr-2 pointer-events-none')} import
				<span class="hidden lg:block">&nbsp;file</span>
			</button>
		</div>
	</div>
</Tooltip.Provider>
<svelte:window
	onkeydown={(e) => {
		switch (e.code) {
			case 'Escape':
				if (appState.selectedSource && !appState.showPalette) {
					showTimelineInProgram();
					showHoverName = false;
				}
				break;
		}
	}}
/>
