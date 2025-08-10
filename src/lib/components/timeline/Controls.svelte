<script>
	import { appState, timelineState } from '$lib/state.svelte';
	import { pause, play } from '$lib/timeline/actions';
	import { framesToTimecode } from '$lib/timeline/utils';
	import PauseIcon from '../icons/PauseIcon.svelte';
	import PlayIcon from '../icons/PlayIcon.svelte';

	let showFrames = $state(false);

	let formattedTime = $derived.by(() => {
		return framesToTimecode(timelineState.currentFrame);
	});
</script>

<div class="h-12 flex-none flex justify-center font-semibold text-2xl items-center">
	<button
		class={[
			!appState.disableHoverStates && 'hover:bg-[#26262c] group',
			'text-white select-non pl-9 pr-3 py-1 mr-6 rounded-lg relative',
			'transition-colors duration-200 hover:duration-0 select-none'
		]}
		onclick={(e) => {
			if (e.ctrlKey) {
				showFrames = !showFrames;
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
