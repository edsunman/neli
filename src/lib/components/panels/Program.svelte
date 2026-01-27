<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, programState, timelineState } from '$lib/state.svelte';
	import { setupWorker } from '$lib/worker/actions.svelte';

	import ClipBox from '../program/ClipBox.svelte';
	import SourceTimeline from '../timeline/SourceTimeline.svelte';
	import { showClipPropertiesSection } from '$lib/properties/actions';
	import { getClipAtCanvasPoint } from '$lib/program/utils';
	import { pause } from '$lib/timeline/actions';
	import { pauseProgram } from '$lib/program/actions';

	let canvas = $state<HTMLCanvasElement>();
	let canvasContainer = $state<HTMLDivElement>();

	const mouseDown = (e: MouseEvent) => {
		if (appState.selectedSource) return;
		pause();
		timelineState.selectedClip = null;
		appState.propertiesSection = 'outputAudio';
		if (!canvasContainer || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) * (canvas.width / rect.width);
		const y = (e.clientY - rect.top) * (canvas.height / rect.height);

		const clip = getClipAtCanvasPoint(x, y);
		if (clip) {
			timelineState.selectedClip = clip;
			showClipPropertiesSection(clip);
		}
		timelineState.invalidate = true;
	};

	const canvasMouseDown = (e: MouseEvent) => {
		if (!appState.selectedSource) return;
		pauseProgram();
		appState.mouseIsDown = true;
		appState.dragAndDrop.currentCursor = { x: e.clientX, y: e.clientY };
		appState.dragAndDrop.clicked = true;
		appState.dragAndDrop.source = appState.selectedSource;
		appState.dragAndDrop.dragFrom = 'program';
	};

	onMount(async () => {
		if (!canvas) return;
		setupWorker(canvas);
	});
</script>

<div class="h-full" style="container-type: size">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onmousedown={mouseDown}
		class="flex-1 h-full relative flex items-center justify-center overflow-hidden px-[5%] [padding-top:calc(5cqh)] [padding-bottom:calc(5cqh)]"
		bind:this={canvasContainer}
	>
		<canvas
			class="object-contain max-w-full max-h-full"
			bind:this={canvas}
			width={1920}
			height={1080}
			onmousedown={canvasMouseDown}
			oncontextmenu={(e) => e.preventDefault()}
		></canvas>

		{#if timelineState.selectedClip && !timelineState.selectedClip.temp && timelineState.currentFrame >= timelineState.selectedClip.start && timelineState.currentFrame < timelineState.selectedClip.start + timelineState.selectedClip.duration}
			<ClipBox clip={timelineState.selectedClip} {canvasContainer} />
		{/if}
		{#if appState.selectedSource}
			{@const sourceType = appState.selectedSource.type}
			{#if sourceType === 'video' || sourceType === 'audio'}
				<SourceTimeline />
			{/if}
		{/if}
	</div>
</div>
