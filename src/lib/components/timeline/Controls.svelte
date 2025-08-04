<script>
	import { appState, timelineState } from '$lib/state.svelte';
	import { pause, play } from '$lib/timeline/actions';
	import PauseIcon from '../icons/PauseIcon.svelte';
	import PlayIcon from '../icons/PlayIcon.svelte';
	import SettingsIcon from '../icons/SettingsIcon.svelte';

	let showFrames = false;

	let formattedTime = $derived.by(() => {
		const FF = timelineState.currentFrame % 30;
		const seconds = (timelineState.currentFrame - FF) / 30;
		const SS = seconds % 60;
		const minutes = (seconds - SS) / 60;
		const MM = minutes % 60;
		return (
			String(MM).padStart(2, '0') +
			':' +
			String(SS).padStart(2, '0') +
			':' +
			String(FF).padStart(2, '0')
		);
	});
</script>

<div class="h-12 flex-none flex justify-center font-semibold text-2xl items-center">
	<button
		class={[
			'text-white select-non hover:bg-[#26262c] pl-9 pr-3 py-1 mr-6 rounded-lg relative group',
			'transition-colors duration-200 hover:duration-0'
		]}
		onclick={(e) => {
			if (timelineState.playing) {
				pause();
			} else {
				play();
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

		<span>{showFrames ? timelineState.currentFrame : formattedTime}</span>
	</button>
	<!-- 	<button
		onclick={() => {
			timelineState.playing = true;
		}}>play</button
	>
	<button
		onclick={() => {
			timelineState.playing = false;
		}}>pause</button
	> -->
</div>
