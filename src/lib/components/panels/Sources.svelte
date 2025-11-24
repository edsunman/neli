<script lang="ts">
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { createClip, finaliseClip, setTrackClipJoins } from '$lib/clip/actions';
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
	import { updateWorkerClip } from '$lib/worker/actions.svelte';
	import {
		getTopTrackOfType,
		getTrackTypeFromSourceType,
		pause,
		setAllTrackTypes
	} from '$lib/timeline/actions';
	import type { Source } from '$lib/source/source.svelte';

	let { mouseMove = $bindable(), mouseUp = $bindable() } = $props();

	let dragHover = $state(false);
	let fileInput = $state<HTMLInputElement>();

	let hoverName = $state('');
	let hoverNameIndex = $state(0);
	let showHoverName = $state(false);

	let startingCursor = { x: 0, y: 0 };
	let cursorMovedEnough = $state(false);

	let selectedFolder = $state(0);
	let filteredSources = $derived.by(() => {
		appState.folderGroups;
		return appState.sources.filter((source) => {
			return source.folderId === selectedFolder;
		});
	});

	mouseMove = (e: MouseEvent) => {
		if (appState.dragAndDrop.clicked) {
			appState.dragAndDrop.x = e.clientX;
			appState.dragAndDrop.y = e.clientY;
			if (!cursorMovedEnough) {
				const distance = Math.sqrt(
					Math.pow(startingCursor.y - e.clientY, 2) + Math.pow(startingCursor.x - e.clientX, 2)
				);
				if (distance > 10) {
					cursorMovedEnough = true;
					appState.dragAndDrop.active = true;
					appState.dragAndDrop.showIcon = true;
					showHoverName = false;
				}
			}
		}
	};

	mouseUp = () => {
		if (appState.dragAndDrop.clicked) {
			appState.dragAndDrop.showIcon = false;
			appState.dragAndDrop.active = false;
			appState.dragAndDrop.clicked = false;
		}
	};

	const onClick = (source: Source) => {
		if (cursorMovedEnough) return;

		timelineState.selectedClips.clear();
		if (source.type === 'srt') {
			// TODO: tidy this up
			for (const entry of source.srtEntries) {
				//console.log(entry.text);
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
		historyManager.finishCommand();
	};

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

<Tooltip.Provider delayDuration={500}>
	<div class="mt-5 height-lg:mt-12 ml-16 xl:ml-[calc(100svw/20)] relative">
		<div class="absolute -left-13">
			<div class="mb-5 bg-zinc-900 border-zinc-900 border-2 rounded">
				<div class=" flex flex-col bg-zinc-950 rounded">
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
						<span class="ml-1 px-1.5 py-0.5 rounded-sm bg-zinc-350">P</span>
					</MyTooltip>
				</div>
			</div>
			<div class="mb-5 bg-zinc-900 border-zinc-900 border-2 rounded">
				<div class=" flex flex-col bg-zinc-950 rounded">
					<MyTooltip
						contentProps={{ side: 'right' }}
						triggerProps={{
							onclick: () => {
								appState.folderGroups.forEach((group) => {
									group.folders.forEach((folder) => {
										folder.selected = false;
									});
								});
								selectedFolder = 0;
							}
						}}
						>{#snippet trigger()}
							<div
								class={[
									selectedFolder === 0 ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
									'p-2'
								]}
							>
								{@render presetsIcon('w-6 h-6')}
							</div>
						{/snippet}
						{appState.sources.length < 5 ? 'sources' : 'presets'}
					</MyTooltip>
				</div>
			</div>
			{#each appState.folderGroups as group}
				<div class="mb-5 bg-hover rounded border-hover border-2">
					<div class="flex flex-col bg-zinc-950 rounded">
						{#each group.folders as folder}
							<button
								onclick={() => {
									appState.folderGroups.forEach((group) => {
										group.folders.forEach((folder) => {
											folder.selected = false;
										});
									});
									folder.selected = true;
									selectedFolder = folder.id;
								}}
								class={[
									folder.selected ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
									'p-2'
								]}
							>
								{@render folderIcon('w-6 h-6')}
							</button>
						{/each}
					</div>
					{#if group.type === 'graphics'}
						{@render textIcon('w-5 h-5 mx-2.5 my-1 text-zinc-950')}
					{:else if group.type === 'video'}
						{@render filmIcon('w-5 h-5 mx-2.5 my-1 text-zinc-950')}
					{:else if group.type === 'audio'}
						{@render audioIcon('w-5 h-5 mx-2.5 my-1 text-zinc-950')}
					{/if}
				</div>
			{/each}
		</div>

		<div
			style:top={`${hoverNameIndex * 56}px`}
			class={[
				showHoverName ? 'visible' : 'invisible',
				'absolute bg-hover h-14 ml-20 text-left flex text-zinc-300',
				'items-center z-10 rounded-lg pointer-events-none text-sm pr-3 text-nowrap'
			]}
		>
			{hoverName}
		</div>
		<div class="text-zinc-500 text-sm w-full flex flex-col relative">
			{#each filteredSources as source, i}
				<!-- svelte-ignore a11y_mouse_events_have_key_events -->
				<button
					onmouseover={() => {
						if (appState.mouseIsDown) return;
						showHoverName = true;
						hoverName = source.name ?? '';
						hoverNameIndex = i;
					}}
					onmouseout={() => {
						showHoverName = false;
						hoverName = '';
					}}
					class={[
						!appState.mouseIsDown && 'hover:text-zinc-300 hover:bg-hover',
						appState.dragAndDrop.clicked &&
							appState.dragAndDrop.source?.id === source.id &&
							'bg-hover text-zinc-300',
						'group h-14 lg:w-full pl-20 select-none text-left relative',
						' rounded-lg'
					]}
					onmousedown={(e) => {
						pause();
						cursorMovedEnough = false;
						startingCursor = { x: e.clientX, y: e.clientY };

						appState.mouseIsDown = true;
						appState.dragAndDrop.clicked = true;
						appState.dragAndDrop.showIcon = false;
						appState.dragAndDrop.source = source;
						timelineState.selectedClip = null;
						timelineState.selectedClips.clear();
						timelineState.invalidate = true;
					}}
					onclick={() => onClick(source)}
				>
					<span
						style:background-image={`url(${source.thumbnail})`}
						class={[
							source.type === 'text' || source.type === 'srt' ? 'bg-clip-purple-500' : '',
							source.type === 'test' ? 'bg-clip-green-500' : '',
							source.type === 'audio' ? 'bg-clip-blue-500' : '',
							appState.dragAndDrop.active && appState.dragAndDrop.source?.id === source.id
								? 'opacity-10'
								: 'opacity-80',
							'h-10 w-14 flex flex-wrap justify-center content-center top-2 left-2 absolute',
							'rounded-lg transition-opacity bg-cover bg-center'
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
			<div
				class={[
					dragHover ? 'border-zinc-300 text-zinc-200' : 'border-zinc-800 text-zinc-800',
					!appState.mouseIsDown && 'hover:border-zinc-500 hover:text-zinc-400',
					'rounded-lg border-2 select-none ',
					'border-dashed items-center justify-center flex h-14 mt-2 ml-2'
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
				{@render addIcon('size-5 mr-2 pointer-events-none')} import
				<span class="hidden lg:block">&nbsp;file</span>
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
