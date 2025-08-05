<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { setupWorker, updateWorkerClip } from '$lib/worker/actions.svelte';

	let { mouseMove = $bindable(), mouseUp = $bindable() } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let width = $state(0);
	let height = $state(0);
	let scale = $derived((width / 1920) * 80);

	let dragging = false;
	let draggedOffset = { x: 0, y: 0 };
	let mouseDownPosition = { x: 0, y: 0 };
	let savedClipPosition = { x: 0, y: 0 };

	mouseMove = (e: MouseEvent, parentX: number, parentY: number) => {
		if (appState.mouseMoveOwner !== 'program' || !dragging) return;
		if (e.buttons < 1 || !timelineState.selectedClip) return;

		draggedOffset.x = e.clientX - mouseDownPosition.x;
		draggedOffset.y = e.clientY - mouseDownPosition.y;

		const newX = savedClipPosition.x + (draggedOffset.x / (scale / 100) / 1920) * 2;
		timelineState.selectedClip.params[2] = Math.round(newX * 100) / 100;
		const newY = savedClipPosition.y - (draggedOffset.y / (scale / 100) / 1080) * 2;
		timelineState.selectedClip.params[3] = Math.round(newY * 100) / 100;

		updateWorkerClip(timelineState.selectedClip);
	};

	onMount(async () => {
		if (!canvas) return;
		setupWorker(canvas);
	});
</script>

<div class="h-full relative overflow-hidden" bind:clientHeight={height} bind:clientWidth={width}>
	<div
		class="absolute"
		style:top={`${height / 2 - 540}px`}
		style:left={`${width / 2 - 960}px`}
		style:transform={`scale(${scale}%)`}
	>
		<canvas bind:this={canvas} width={1920} height={1080}></canvas>
	</div>
	{#if timelineState.selectedClip && timelineState.currentFrame >= timelineState.selectedClip.start && timelineState.currentFrame < timelineState.selectedClip.start + timelineState.selectedClip.duration}
		{@const clip = timelineState.selectedClip}
		{@const boxSizeX = clip.params[0] * clip.source.width * (scale / 100)}
		{@const boxSizeY = clip.params[1] * clip.source.height * (scale / 100)}
		{@const offsetX = (clip.params[2] / 2) * clip.source.width * (scale / 100)}
		{@const offsetY = (clip.params[3] / 2) * clip.source.height * (scale / 100)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_mouse_events_have_key_events -->
		<div
			style:top={`${height / 2 - boxSizeY / 2 - offsetY}px`}
			style:left={`${width / 2 - boxSizeX / 2 + offsetX}px`}
			style:width={`${boxSizeX}px`}
			style:height={`${boxSizeY}px`}
			class="border-2 border-white absolute top-0 left-0"
			onmousedown={(e) => {
				dragging = true;
				savedClipPosition = { x: clip.params[2], y: clip.params[3] };
				mouseDownPosition = { x: e.clientX, y: e.clientY };
				appState.mouseMoveOwner = 'program';
				appState.disableHoverStates = true;
			}}
			onmouseup={() => {
				dragging = false;
				appState.disableHoverStates = false;
				appState.mouseMoveOwner = 'timeline';
				const clip = timelineState.selectedClip;
				if (!clip) return;
				historyManager.pushAction({
					action: 'clipParam',
					data: {
						clipId: clip.id,
						paramIndex: 2,
						oldValue: savedClipPosition.x,
						newValue: clip.params[2]
					}
				});
				historyManager.pushAction({
					action: 'clipParam',
					data: {
						clipId: clip.id,
						paramIndex: 3,
						oldValue: savedClipPosition.y,
						newValue: clip.params[3]
					}
				});
				historyManager.finishCommand();
			}}
		></div>
	{/if}
</div>
