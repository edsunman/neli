<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, programState, timelineState } from '$lib/state.svelte';
	import { setupWorker } from '$lib/worker/actions.svelte';
	import { getClipsAtFrame } from '$lib/clip/actions';
	import { measureText } from '$lib/text/utils';

	import ClipBox from '../program/ClipBox.svelte';
	import SourceTimeline from '../timeline/SourceTimeline.svelte';
	import { showClipPropertiesSection } from '$lib/properties/actions';

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
		timelineState.selectedClip = null;
		const clips = getClipsAtFrame(timelineState.currentFrame);
		for (const clip of clips) {
			if (clip.source.type === 'audio') continue;
			const box = { height: 0, width: 0, centerX: 0, centerY: 0 };
			if (clip.source.type === 'text') {
				const measurements = measureText(clip.text, appState.fonts[0], clip.params[7]);
				// scale factor based on font size and arbitrary number
				const scaleFactor = clip.params[6] / 9.3;
				box.width = measurements.width * scaleFactor;
				box.height = measurements.height * scaleFactor;
			} else if (clip.source.info.type === 'video' || clip.source.info.type === 'image') {
				box.width = clip.source.info.resolution.width * clip.params[0];
				box.height = clip.source.info.resolution.height * clip.params[1];
			} else if (clip.source.info.type === 'test') {
				box.width = 1920 * clip.params[0];
				box.height = 1080 * clip.params[1];
			}
			box.centerX = (clip.params[2] / 2 + 0.5) * programState.canvasWidth;
			box.centerY = (1 - (clip.params[3] / 2 + 0.5)) * programState.canvasHeight;
			if (
				e.offsetX > box.centerX - box.width / 2 &&
				e.offsetX < box.centerX + box.width / 2 &&
				e.offsetY > box.centerY - box.height / 2 &&
				e.offsetY < box.centerY + box.height / 2
			) {
				timelineState.selectedClip = clip;
				showClipPropertiesSection(clip);
				break;
			}
		}
		timelineState.invalidate = true;
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
