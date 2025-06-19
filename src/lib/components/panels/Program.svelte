<script lang="ts">
	import { onMount } from 'svelte';
	import { timelineState } from '$lib/state.svelte';
	import { setupRenderer } from '$lib/renderer/actions';

	let element = $state<HTMLCanvasElement>();
	let width = $state(0);
	let height = $state(0);
	let scale = $state(35);

	onMount(async () => {
		if (!element) return;
		setupRenderer(element);
	});
</script>

<div class="h-full relative overflow-hidden" bind:clientHeight={height} bind:clientWidth={width}>
	<div
		class="absolute"
		style:top={`${height / 2 - 540}px`}
		style:left={`${width / 2 - 960}px`}
		style:transform={`scale(${scale}%)`}
	>
		<canvas bind:this={element} width={1920} height={1080}></canvas>
	</div>
	{#if timelineState.selectedClip}
		{@const clip = timelineState.selectedClip}
		{@const boxSizeX = clip.scaleX * clip.source.width * (scale / 100)}
		{@const boxSizeY = clip.scaleY * clip.source.height * (scale / 100)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_mouse_events_have_key_events -->
		<div
			style:top={`${height / 2 - boxSizeY / 2}px`}
			style:left={`${width / 2 - boxSizeX / 2}px`}
			style:width={`${boxSizeX}px`}
			style:height={`${boxSizeY}px`}
			class="border-2 border-amber-200 absolute top-0 left-0"
		></div>
	{/if}
</div>
