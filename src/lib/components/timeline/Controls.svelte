<script lang="ts">
	import {
		pauseProgram,
		playProgram,
		resetInOutPoints,
		setInPoint,
		setOutPoint
	} from '$lib/program/actions';
	import { appState, programState, timelineState } from '$lib/state.svelte';
	import { pause, play, setTimelineTool, zoomIn, zoomOut } from '$lib/timeline/actions';
	import { calculateMaxZoomLevel, framesToTimecode } from '$lib/timeline/utils';
	import type { Snippet } from 'svelte';
	import {
		pauseIcon,
		playIcon,
		seekIcon,
		copyIcon,
		mouseIcon,
		zoomInIcon,
		zoomOutIcon,
		pointerIcon,
		handIcon,
		scissorsIcon,
		inPointIcon,
		outPointIcon,
		undoIcon
	} from '../icons/Icons.svelte';
	import { Tooltip } from 'bits-ui';

	import ContextMenu from '../ui/ContextMenu.svelte';
	import MyTooltip from '../ui/Tooltip.svelte';

	let showFrames = $state(false);

	let formattedTime = $derived.by(() => {
		return framesToTimecode(timelineState.currentFrame);
	});

	let formattedProgramTime = $derived.by(() => {
		let fps = 30;
		if (appState.selectedSource && appState.selectedSource.info.type === 'video')
			fps = appState.selectedSource.info.frameRate;
		return framesToTimecode(programState.currentFrame, fps);
	});

	let disablePlaybackButton = $derived.by(() => {
		if (
			appState.selectedSource &&
			appState.selectedSource.type !== 'video' &&
			appState.selectedSource.type !== 'audio'
		)
			return true;
	});

	let contextMenu: ContextMenu;
	const buttons = $state([
		{
			text: 'show frames',
			icon: seekIcon,
			onclick: () => {
				showFrames = !showFrames;
				buttons[0].text = showFrames ? 'show timecode' : 'show frames';
			},
			shortcuts: ['shift', mouseIcon]
		},
		{
			text: 'copy timecode',
			icon: copyIcon,
			onclick: async () => {
				const type = 'text/plain';
				const clipboardItemData = {
					[type]: framesToTimecode(
						appState.selectedSource ? programState.currentFrame : timelineState.currentFrame
					)
				};
				const clipboardItem = new ClipboardItem(clipboardItemData);
				await navigator.clipboard.write([clipboardItem]);
			},
			shortcuts: []
		}
	]);
</script>

<div class="h-12 flex-none flex justify-center font-semibold text-2xl items-center">
	<Tooltip.Provider delayDuration={500}>
		<div class="h-full w-48 mr-12 flex justify-end">
			{#if appState.selectedSource}
				{#if appState.selectedSource.type === 'audio' || appState.selectedSource.type === 'video'}
					{@render button('set in point', 'I', inPointIcon, () => setInPoint(), false, false)}
					{@render button('set out point', 'O', outPointIcon, () => setOutPoint(), false, false)}
				{/if}
			{:else}
				{@render button(
					'pointer tool',
					'1',
					pointerIcon,
					() => setTimelineTool('pointer'),
					false,
					timelineState.selectedTool === 'pointer'
				)}
				{@render button(
					'hand tool',
					'2',
					handIcon,
					() => setTimelineTool('hand'),
					false,
					timelineState.selectedTool === 'hand'
				)}
				{@render button(
					'scissors tool',
					'3',
					scissorsIcon,
					() => setTimelineTool('scissors'),
					false,
					timelineState.selectedTool === 'scissors'
				)}
			{/if}
		</div>
		<button
			class={[
				!appState.mouseIsDown && !disablePlaybackButton && 'hover:bg-zinc-700 group',
				'text-white pl-9 pr-3 py-1 bg-hover rounded-lg relative',
				'transition-colors duration-200 hover:duration-0 select-none'
			]}
			oncontextmenu={(e) => {
				e.preventDefault();
				contextMenu.openContextMenu(e);
			}}
			onclick={(e) => {
				if (e.shiftKey) {
					showFrames = !showFrames;
					buttons[0].text = showFrames ? 'show timecode' : 'show frames';
				} else {
					if (timelineState.playing || programState.playing) {
						appState.selectedSource ? pauseProgram() : pause();
					} else {
						appState.selectedSource ? playProgram() : play();
					}
				}
			}}
			onmouseup={(e) => {
				e.currentTarget.blur();
			}}
		>
			{#if timelineState.playing}
				{@render pauseIcon(
					`absolute size-3.5 left-3 top-[13px] ${disablePlaybackButton && 'opacity-10'}`
				)}
			{:else}
				{@render playIcon(
					`absolute size-3.5 left-3 top-[13px] ${disablePlaybackButton && 'opacity-10'}`
				)}
			{/if}

			<span>
				{#if appState.selectedSource}
					{showFrames ? programState.currentFrame : formattedProgramTime}
				{:else}
					{showFrames ? timelineState.currentFrame : formattedTime}
				{/if}
			</span>
		</button>
		<div class="h-full ml-12 w-48 flex">
			{#if appState.selectedSource}
				{#if appState.selectedSource.type === 'audio' || appState.selectedSource.type === 'video'}
					{@render button(
						'reset in/out points',
						'I',
						undoIcon,
						() => resetInOutPoints(),
						false,
						false
					)}
				{/if}
			{:else}
				{@render button('zoom out', '-', zoomOutIcon, zoomOut, timelineState.zoom <= 0.9)}
				{@render button(
					'zoom in',
					'P',
					zoomInIcon,
					zoomIn,
					timelineState.zoom >= calculateMaxZoomLevel()
				)}
			{/if}
		</div>
	</Tooltip.Provider>
</div>

<ContextMenu bind:this={contextMenu} {buttons} />

{#snippet button(
	description: string,
	shortcut: string,
	icon: Snippet<[string]>,
	onclick: () => void,
	disabled = false,
	selected = false
)}
	<MyTooltip
		contentProps={{ side: 'bottom' }}
		triggerProps={{
			onclick,
			onmouseup: (e) => e.currentTarget.blur(),
			onmouseleave: (e) => e.currentTarget.blur()
		}}
	>
		{#snippet trigger()}
			<div
				class={[
					disabled
						? 'text-zinc-700 opacity-50'
						: selected
							? 'text-zinc-50 bg-zinc-700'
							: 'text-zinc-600 hover:text-zinc-400 active:text-zinc-50',
					'mx-1 py-1.5 px-1.5 rounded-lg h-9'
				]}
			>
				{@render icon('size-6')}
			</div>
		{/snippet}
		{description}
		{#if shortcut}
			<span class="ml-1 px-1.5 py-0.5 rounded-sm border border-zinc-400 text-zinc-500"
				>{shortcut}</span
			>
		{/if}
	</MyTooltip>
{/snippet}

<svelte:window
	onkeydown={(e: KeyboardEvent) => {
		if (appState.disableKeyboardShortcuts) return;
		if (appState.showPalette) return;
		switch (e.code) {
			case 'Digit1': {
				setTimelineTool('pointer');
				break;
			}
			case 'Digit2': {
				setTimelineTool('hand');
				break;
			}
			case 'Digit3': {
				setTimelineTool('scissors');
				break;
			}
		}
	}}
/>
