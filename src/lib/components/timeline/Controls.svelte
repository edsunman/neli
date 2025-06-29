<script>
	import { timelineState } from '$lib/state.svelte';

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

<div class="h-12 flex-none flex justify-center font-semibold text-2xl">
	<div class="text-white select-none">
		{showFrames ? timelineState.currentFrame : formattedTime}
	</div>
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
