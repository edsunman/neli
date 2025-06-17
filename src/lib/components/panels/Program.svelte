<script lang="ts">
	import { onMount } from 'svelte';
	import { setupRenderer } from '$lib/renderer/actions';

	let element = $state<HTMLCanvasElement>();
	let width = $state(0);
	let height = $state(0);
	let scale = $state(40);

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
</div>
