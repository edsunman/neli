<script lang="ts">
	import { onMount } from 'svelte';
	import { timelineState } from '$lib/state.svelte';
	import { setupWorker } from '$lib/renderer/actions';

	let element = $state<HTMLCanvasElement>();
	let width = $state(0);
	let height = $state(0);
	let scale = $state(35);

	let draggedOffset = { x: 0, y: 0 };
	let mouseDownPosition = { x: 0, y: 0 };
	let savedClipPosition = { x: 0, y: 0 };

	onMount(async () => {
		if (!element) return;
		setupWorker(element);
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
	{#if timelineState.selectedClip && timelineState.currentFrame > timelineState.selectedClip.start && timelineState.currentFrame < timelineState.selectedClip.start + timelineState.selectedClip.duration}
		{@const clip = timelineState.selectedClip}
		{@const boxSizeX = clip.scaleX * clip.source.width * (scale / 100)}
		{@const boxSizeY = clip.scaleY * clip.source.height * (scale / 100)}
		{@const offsetX = (clip.positionX / 2) * clip.source.width * (scale / 100)}
		{@const offsetY = (clip.positionY / 2) * clip.source.height * (scale / 100)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_mouse_events_have_key_events -->
		<div
			style:top={`${height / 2 - boxSizeY / 2 - offsetY}px`}
			style:left={`${width / 2 - boxSizeX / 2 + offsetX}px`}
			style:width={`${boxSizeX}px`}
			style:height={`${boxSizeY}px`}
			class="border-2 border-amber-200 absolute top-0 left-0"
			onmousedown={(e) => {
				savedClipPosition = { x: clip.positionX, y: clip.positionY };
				//	console.log(clip.positionX);
				mouseDownPosition = { x: e.clientX, y: e.clientY };
			}}
			onmousemove={(e) => {
				if (e.buttons < 1) return;
				draggedOffset.x = e.clientX - mouseDownPosition.x;
				draggedOffset.y = e.clientY - mouseDownPosition.y;
				//console.log(draggedOffset.x);
				clip.positionX = savedClipPosition.x + (draggedOffset.x / (scale / 100) / 1920) * 2;
				clip.positionY = savedClipPosition.y - (draggedOffset.y / (scale / 100) / 1080) * 2;
				//(savedClipPosition.x + draggedOffset.x) / (clip.source.width * (scale / 50));
				//console.log(((savedClipPosition.x + draggedOffset.x) / (scale / 100) / 1920) * 2);
			}}
		></div>
	{/if}
</div>
