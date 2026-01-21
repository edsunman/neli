<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, programState, timelineState } from '$lib/state.svelte';
	import { setupWorker } from '$lib/worker/actions.svelte';

	import ClipBox from '../program/ClipBox.svelte';
	import SourceTimeline from '../timeline/SourceTimeline.svelte';
	import { showClipPropertiesSection } from '$lib/properties/actions';
	import { getClipAtCanvasPoint } from '$lib/program/utils';

	let canvas = $state<HTMLCanvasElement>();
	let canvasContainer = $state<HTMLDivElement>();

	let width = $state(0);
	let height = $state(0);
	let scale = $derived.by(() => {
		const widthScale = (width / programState.canvasWidth) * 90;
		const heightScale = (height / programState.canvasHeight) * 90;
		return heightScale < widthScale ? heightScale : widthScale;
	});

	const canvasMouseDown = (e: MouseEvent) => {
		if (appState.selectedSource) {
			appState.mouseIsDown = true;
			appState.dragAndDrop.currentCursor = { x: e.clientX, y: e.clientY };
			appState.dragAndDrop.clicked = true;
			appState.dragAndDrop.source = appState.selectedSource;
			appState.dragAndDrop.dragFrom = 'program';
		} else {
			timelineState.selectedClip = null;
			const clip = getClipAtCanvasPoint(e.offsetX, e.offsetY);
			if (clip) {
				timelineState.selectedClip = clip;
				showClipPropertiesSection(clip);
			}
			timelineState.invalidate = true;
		}
	};

	onMount(async () => {
		if (!canvas) return;
		setupWorker(canvas);
	});
</script>

<div class="flex flex-col h-full">
	<div
		class="flex-1 h-full relative overflow-hidden"
		bind:this={canvasContainer}
		bind:clientHeight={height}
		bind:clientWidth={width}
	>
		<div
			class="absolute"
			style:top={`${height / 2 - programState.canvasHeight / 2}px`}
			style:left={`${width / 2 - programState.canvasWidth / 2}px`}
			style:transform={`scale(${scale}%)`}
		>
			<canvas
				bind:this={canvas}
				width={1920}
				height={1080}
				onmousedown={canvasMouseDown}
				oncontextmenu={(e) => {
					e.preventDefault();
				}}
			></canvas>
		</div>
		{#if timelineState.selectedClip && !timelineState.selectedClip.temp && timelineState.currentFrame >= timelineState.selectedClip.start && timelineState.currentFrame < timelineState.selectedClip.start + timelineState.selectedClip.duration}
			<ClipBox clip={timelineState.selectedClip} {scale} {width} {height} {canvasContainer} />
		{/if}
	</div>
	{#if appState.selectedSource}
		{@const sourceType = appState.selectedSource.type}
		{#if sourceType === 'video' || sourceType === 'audio'}
			<SourceTimeline />
		{/if}
	{/if}
</div>
