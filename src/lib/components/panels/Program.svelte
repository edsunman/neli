<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, audioManager, timelineState } from '$lib/state.svelte';
	import { setupWorker } from '$lib/worker/actions';

	let { mouseMove = $bindable(), mouseUp = $bindable() } = $props();

	$inspect(audioManager.audioLevel);

	let element = $state<HTMLCanvasElement>();
	let width = $state(0);
	let height = $state(0);
	let scale = $derived((width / 1920) * 80);

	let draggedOffset = { x: 0, y: 0 };
	let mouseDownPosition = { x: 0, y: 0 };
	let savedClipPosition = { x: 0, y: 0 };

	mouseMove = (e: MouseEvent) => {
		if (appState.mouseMoveOwner !== 'program') return;
		if (e.buttons < 1 || !timelineState.selectedClip) return;
		e.preventDefault();
		draggedOffset.x = e.clientX - mouseDownPosition.x;
		draggedOffset.y = e.clientY - mouseDownPosition.y;

		timelineState.selectedClip.positionX =
			savedClipPosition.x + (draggedOffset.x / (scale / 100) / 1920) * 2;
		timelineState.selectedClip.positionY =
			savedClipPosition.y - (draggedOffset.y / (scale / 100) / 1080) * 2;
	};

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
	<div
		style:height={`${1080 * (scale / 100)}px`}
		style:top={`${height / 2 - 540 * (scale / 100)}px`}
		style:left={`${width / 2 + 960 * (scale / 92)}px`}
		class="w-3.5 absolute flex justify-between"
	>
		<div
			class="w-1.5 h-full"
			style="background:linear-gradient(0deg,rgba(87, 199, 133, 1) 0%, rgba(87, 199, 133, 1) 83%, rgba(237, 221, 83, 1) 83%);"
			style:clip-path={`rect(${(1 - audioManager.audioLevel) * 100}% 100% 100% 0%)`}
		></div>
		<div
			class="w-1.5 h-full"
			style="background:linear-gradient(0deg,rgba(87, 199, 133, 1) 0%, rgba(87, 199, 133, 1) 83%, rgba(237, 221, 83, 1) 83%);"
			style:clip-path={`rect(${(1 - audioManager.audioLevel) * 100}% 100% 100% 0%)`}
		></div>
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
				mouseDownPosition = { x: e.clientX, y: e.clientY };
				appState.mouseMoveOwner = 'program';
			}}
			onmousemove={mouseMove}
		></div>
	{/if}
</div>
