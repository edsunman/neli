<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { pause, play } from '$lib/timeline/actions';
	import { framesToTimecode } from '$lib/timeline/utils';
	import { Portal } from 'bits-ui';

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
			!appState.disableHoverStates && 'hover:bg-[#26262c] group',
			'text-white select-non pl-9 pr-3 py-1 mr-6 rounded-lg relative',
			'transition-colors duration-200 hover:duration-0 select-none'
		]}
		oncontextmenu={(e) => {
			e.preventDefault();
			contextMenu.openContextMenu(e);
			//showContextMenu = true;
			//contextMenuPosition.x = e.clientX;
			//contextMenuPosition.y = e.clientY;
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
			<PauseIcon
				class={[
					'absolute size-3.5 left-3 top-[13px] group-hover:opacity-100 opacity-0',
					'transition-opacity duration-200 group-hover:duration-0'
				]}
			/>
		{:else}
			<PlayIcon
				class={[
					'absolute size-3.5 left-3 top-[13px] group-hover:opacity-100 opacity-0',
					'transition-opacity duration-200 group-hover:duration-0'
				]}
			/>
		{/if}

		<span>
			{showFrames ? timelineState.currentFrame : formattedTime}
		</span>
	</button>
</div>

<ContextMenu bind:this={contextMenu} {buttons} />

<!-- {#if showContextMenu}
	<Portal>
		
		<div
			class="h-dvh w-dvw absolute top-0 left-0 z-10"
			onmousedown={() => {
				showContextMenu = false;
			}}
		>
			<div
				style:top={`${contextMenuPosition.y + 5}px`}
				style:left={`${contextMenuPosition.x + 5}px`}
				class="absolute bg-zinc-200 p-1 rounded-lg text-sm flex flex-col"
				onmousedown={(e) => {
					e.stopPropagation();
				}}
			>
				<button
					class="px-2 py-1.5 rounded-lg text-left hover:bg-zinc-350 group flex items-center"
					onclick={async () => {
						showFrames = !showFrames;
						showContextMenu = false;
					}}
				>
					<SeekIcon class="size-4 inline mr-2" />show {showFrames ? 'timecode' : 'frames'}
					<span class="ml-7 px-1.5 py-0.5 rounded-sm bg-zinc-350 group-hover:bg-zinc-370">
						shift
					</span>
					+
					<span class="px-1.5 py-0.5 rounded-sm bg-zinc-350 group-hover:bg-zinc-370">
						<MouseIcon class="size-4 inline" />
					</span>
				</button>
				<button
					class="px-1.5 py-2 rounded-lg text-left hover:bg-zinc-350 flex items-center"
					onclick={async () => {
						const type = 'text/plain';
						const clipboardItemData = {
							[type]: framesToTimecode(timelineState.currentFrame)
						};
						const clipboardItem = new ClipboardItem(clipboardItemData);
						await navigator.clipboard.write([clipboardItem]);
						showContextMenu = false;
					}}
				>
					<CopyIcon class="size-4 inline mr-2" />copy timecode
					
				</button>
			</div>
		</div>
	</Portal>
{/if} -->
