<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, historyManager, programState, timelineState } from '$lib/state.svelte';
	import { setupWorker, updateWorkerClip } from '$lib/worker/actions.svelte';

	import ClipBox from '../program/ClipBox.svelte';
	import SourceTimeline from '../timeline/SourceTimeline.svelte';
	import { showClipPropertiesSection } from '$lib/properties/actions';
	import { getClipAtCanvasPoint } from '$lib/program/utils';
	import { pause } from '$lib/timeline/actions';
	import { pauseProgram } from '$lib/program/actions';

	let canvas = $state<HTMLCanvasElement>();
	let canvasContainer = $state<HTMLDivElement>();
	let containerHeight = $state(0);
	let containerWidth = $state(0);

	let dragging = false;
	let draggedOffset = { x: 0, y: 0 };
	let mouseDownPosition = { x: 0, y: 0 };
	let savedClipPosition = { x: 0, y: 0 };

	let scale = $derived.by(() => {
		const widthScale = (containerWidth / programState.canvasWidth) * 90;
		const heightScale = (containerHeight / programState.canvasHeight) * 90;
		return heightScale < widthScale ? heightScale : widthScale;
	});

	const mouseDown = (e: MouseEvent) => {
		if (appState.selectedSource) return;
		appState.mouseMoveOwner = 'program';
		appState.mouseIsDown = true;
		pause();

		timelineState.selectedClips.clear();
		timelineState.selectedClip = null;
		programState.selectedClip = null;
		appState.propertiesSection = 'outputAudio';

		if (!canvasContainer || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) * (canvas.width / rect.width);
		const y = (e.clientY - rect.top) * (canvas.height / rect.height);

		const clip = getClipAtCanvasPoint(x, y);
		if (clip) {
			timelineState.selectedClip = clip;
			programState.selectedClip = clip;
			showClipPropertiesSection(clip);
			dragging = true;
			savedClipPosition = { x: clip.params[2], y: clip.params[3] };
			mouseDownPosition = { x: e.clientX, y: e.clientY };
		}
		timelineState.invalidate = true;
	};

	const mouseMove = (e: MouseEvent) => {
		if (appState.mouseMoveOwner !== 'program' || !dragging) return;
		if (e.buttons < 1 || !programState.selectedClip || !canvasContainer) return;

		draggedOffset.x = e.clientX - mouseDownPosition.x;
		draggedOffset.y = e.clientY - mouseDownPosition.y;
		const newX =
			savedClipPosition.x + (draggedOffset.x / (scale / 100) / programState.canvasWidth) * 2;
		programState.selectedClip.params[2] = Math.round(newX * 100) / 100;
		const newY =
			savedClipPosition.y - (draggedOffset.y / (scale / 100) / programState.canvasHeight) * 2;
		programState.selectedClip.params[3] = Math.round(newY * 100) / 100;

		updateWorkerClip(timelineState.selectedClip);
	};

	const mouseUp = () => {
		appState.mouseMoveOwner = 'timeline';
		if (dragging) {
			dragging = false;
			const clip = timelineState.selectedClip;
			if (!clip) return;
			historyManager.pushAction({
				action: 'clipParam',
				data: {
					clipId: clip.id,
					paramIndex: [2, 3],
					oldValue: [savedClipPosition.x, savedClipPosition.y],
					newValue: [clip.params[2], clip.params[3]]
				}
			});
			historyManager.finishCommand();
		}
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
		bind:clientHeight={containerHeight}
		bind:clientWidth={containerWidth}
	>
		<canvas
			class="object-contain max-w-full max-h-full"
			bind:this={canvas}
			width={1920}
			height={1080}
			onmousedown={canvasMouseDown}
			oncontextmenu={(e) => e.preventDefault()}
		></canvas>

		{#if programState.selectedClip}
			<ClipBox clip={programState.selectedClip} {canvasContainer} {scale} />
		{/if}
		{#if appState.selectedSource}
			{@const sourceType = appState.selectedSource.type}
			{#if sourceType === 'video' || sourceType === 'audio'}
				<SourceTimeline />
			{/if}
		{/if}
	</div>
</div>
<svelte:window onmousemove={mouseMove} onmouseup={mouseUp} />
