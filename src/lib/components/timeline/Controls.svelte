<script lang="ts">
	import { pauseProgram, playProgram } from '$lib/program/actions';
	import { appState, programState, timelineState } from '$lib/state.svelte';
	import { pause, play } from '$lib/timeline/actions';
	import { framesToTimecode } from '$lib/timeline/utils';
	import { pauseIcon, playIcon, seekIcon, copyIcon, mouseIcon } from '../icons/Icons.svelte';

	import ContextMenu from '../ui/ContextMenu.svelte';

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
	<button
		class={[
			!appState.mouseIsDown && !disablePlaybackButton && 'hover:bg-zinc-700 group',
			'text-white pl-9 pr-3 py-1 mr-6 bg-hover rounded-lg relative',
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
</div>

<ContextMenu bind:this={contextMenu} {buttons} />
