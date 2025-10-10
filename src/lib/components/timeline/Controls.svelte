<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { pause, play } from '$lib/timeline/actions';
	import { framesToTimecode } from '$lib/timeline/utils';

	import PauseIcon from '../icons/PauseIcon.svelte';
	import PlayIcon from '../icons/PlayIcon.svelte';
	import SeekIcon from '../icons/SeekIcon.svelte';
	import CopyIcon from '../icons/CopyIcon.svelte';
	import MouseIcon from '../icons/MouseIcon.svelte';
	import ContextMenu from '../ui/ContextMenu.svelte';

	let showFrames = $state(false);

	let formattedTime = $derived.by(() => {
		return framesToTimecode(timelineState.currentFrame);
	});

	let contextMenu: ContextMenu;
	const buttons = $state([
		{
			text: 'show frames',
			icon: SeekIcon,
			onclick: () => {
				showFrames = !showFrames;
				buttons[0].text = showFrames ? 'show timecode' : 'show frames';
			},
			shortcuts: ['shift', MouseIcon]
		},
		{
			text: 'copy timecode',
			icon: CopyIcon,
			onclick: async () => {
				const type = 'text/plain';
				const clipboardItemData = {
					[type]: framesToTimecode(timelineState.currentFrame)
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
			!appState.mouseIsDown && 'hover:bg-hover group',
			'text-white select-non pl-9 pr-3 py-1 mr-6 rounded-lg relative',
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
				if (timelineState.playing) {
					pause();
				} else {
					play();
				}
			}
			e.currentTarget.blur();
		}}
	>
		{#if timelineState.playing}
			<PauseIcon class={['absolute size-3.5 left-3 top-[13px] ']} />
		{:else}
			<PlayIcon class={['absolute size-3.5 left-3 top-[13px]']} />
		{/if}

		<span>
			{showFrames ? timelineState.currentFrame : formattedTime}
		</span>
	</button>
</div>

<ContextMenu bind:this={contextMenu} {buttons} />
