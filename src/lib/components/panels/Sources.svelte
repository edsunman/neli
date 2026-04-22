<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { Tooltip } from 'bits-ui';
	import {
		addIcon,
		audioIcon,
		textIcon,
		paletteIcon,
		filmIcon,
		folderIcon,
		presetsIcon,
		warningIcon,
		linkIcon,
		deleteIcon
	} from '../icons/Icons.svelte';
	import { pause } from '$lib/timeline/actions';
	import type { Source } from '$lib/source/source.svelte';
	import { clickToRelinkFile, deleteSource, dropToImportFile } from '$lib/source/actions';
	import { showSourceInProgram, showTimelineInProgram } from '$lib/program/actions';

	import ContextMenu from '../ui/ContextMenu.svelte';
	import MyTooltip from '../ui/Tooltip.svelte';
	import { deselectAllClips } from '$lib/clip/actions';

	let dragHover = $state(false);
	let hoverName = $state('');
	let hoverNameIndex = $state(0);
	let showHoverName = $state(false);
	let hoverSelected = $state(false);
	let forceHoverId = $state('');

	let clickedSource: Source | undefined;

	let filteredSources = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		appState.sourceFolders;
		return appState.sources.filter((source) => {
			if (source.deleted) return false;
			return source.folderId === appState.selectedSourceFolder;
		});
	});

	const onClick = (source: Source) => {
		if (source.type === 'test' || source.type === 'text' || source.unlinked) return;
		deselectAllClips();
		timelineState.selectedTool = 'pointer';
		timelineState.invalidate = true;
		hoverSelected = true;
		showSourceInProgram(source);
		appState.propertiesSection = 'source';
	};

	let contextMenu: ContextMenu;
</script>

<Tooltip.Provider delayDuration={500}>
	<div class="mt-5 height-lg:mt-12 ml-16 xl:ml-[calc(100svw/20)] relative">
		<div class="absolute -left-13">
			<div class="bg-zinc-950 rounded-lg flex flex-col mb-5">
				<MyTooltip
					contentProps={{ side: 'right' }}
					triggerProps={{
						onclick: () => {
							appState.palette.page = 'search';
							appState.palette.open = true;
						}
					}}
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

			<div class=" bg-zinc-950 rounded-lg flex flex-col mb-5">
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

				{#each appState.sourceFolders as folder (folder.id)}
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
			{#each filteredSources as source, i (source.id)}
				<!-- svelte-ignore a11y_mouse_events_have_key_events -->
				<button
					oncontextmenu={(e) => {
						e.preventDefault();
						if (source.type === 'test' || source.type === 'text') return;
						forceHoverId = source.id;
						clickedSource = source;
						contextMenu.openContextMenu(e);
					}}
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
						!appState.dragAndDrop.clicked &&
							source.id !== appState.selectedSource?.id &&
							'hover:text-zinc-300 hover:bg-hover',
						forceHoverId === source.id && 'text-zinc-300 bg-hover',
						// dragged
						appState.dragAndDrop.clicked &&
							appState.dragAndDrop.dragFrom === 'sources' &&
							appState.dragAndDrop.source?.id === source.id &&
							'bg-hover',

						'group h-14 lg:w-full pl-20 select-none text-left relative',
						'focus-visible:ring-2 ring-zinc-300 focus-visible:outline-none',
						'rounded-lg'
					]}
					onmousedown={(e) => {
						if (e.button > 0) return;
						pause();
						appState.mouseIsDown = true;

						if (source.unlinked) return;
						appState.dragAndDrop.currentCursor = { x: e.clientX, y: e.clientY };
						appState.dragAndDrop.clicked = true;
						appState.dragAndDrop.dragFrom = 'sources';
						appState.dragAndDrop.source = source;
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
						style:background-image={!source.unlinked ? `url(${source.thumbnail})` : ''}
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
							source.type === 'audio' && !source.unlinked ? 'bg-clip-blue-500' : '',
							source.unlinked ? 'bg-red-950' : '',
							'h-10 w-14 flex flex-wrap justify-center content-center top-2 left-2 absolute',
							'rounded-lg transition-opacity duration-200 bg-cover bg-center'
						]}
					>
						{#if source.unlinked}
							{@render warningIcon('text-red-500 w-6 h-6 text-clip-purple-600')}
						{:else if source.type === 'text'}
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
			<button
				class={[
					dragHover ? 'border-zinc-300 text-zinc-200' : 'border-zinc-600 text-zinc-500',
					!appState.mouseIsDown && 'hover:border-zinc-500 hover:text-zinc-400',
					'focus:border-zinc-300 focus:text-zinc-200 focus:outline-none',
					'[&:nth-child(n+8)]:hidden height-xl:[&:nth-child(n+8)]:flex rounded-lg border-2 select-none ',
					'border-dashed items-center justify-center flex h-14 mt-2 ml-2'
				]}
				ondrop={(e) => {
					e.preventDefault();
					dragHover = false;
					dropToImportFile(e);
				}}
				ondragenter={() => {
					dragHover = true;
				}}
				ondragleave={() => {
					dragHover = false;
				}}
				ondragover={(e) => e.preventDefault()}
				onclick={() => {
					appState.import.importStarted = false;
					appState.palette.page = 'import';
					appState.palette.open = true;
				}}
			>
				{@render addIcon('size-5 pointer-events-none')}
				<span class="hidden lg:ml-2 ml-1 md:block">import</span>
				<span class="hidden lg:block">&nbsp;file</span>
			</button>
		</div>
	</div>
</Tooltip.Provider>

<ContextMenu
	bind:this={contextMenu}
	buttons={[
		{
			text: 'relink file',
			icon: linkIcon,
			onClick: () => {
				clickToRelinkFile(clickedSource?.id || '');
			},
			disableCondition: () => {
				if (clickedSource) return !clickedSource.unlinked;
				return false;
			}
		},
		{
			text: 'delete source',
			icon: deleteIcon,
			onClick: () => {
				if (clickedSource) deleteSource(clickedSource);
			},
			disableCondition: () => {
				for (const clip of timelineState.clips) {
					if (clip.deleted) continue;
					if (clickedSource && clip.source.id === clickedSource.id) return true;
				}
				return false;
			}
		}
	]}
	onClose={() => {
		forceHoverId = '';
	}}
/>

<svelte:window
	onkeydown={(e) => {
		switch (e.code) {
			case 'Escape':
				if (appState.selectedSource && !appState.palette.open) {
					showTimelineInProgram();
					showHoverName = false;
				}
				break;
		}
	}}
/>
