<script lang="ts">
	import { useAnimationFrame } from '$lib/hooks/useAnimationFrame';
	import {
		setCurrentFrame,
		setCurrentFrameFromOffset,
		setInPoint,
		setOutPoint
	} from '$lib/program/actions';
	import { appState, programState } from '$lib/state.svelte';
	import { drawSourceCanvas } from '$lib/timeline/canvas';
	import { onMount, tick } from 'svelte';

	const { onFrame } = useAnimationFrame();

	let canvas: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null;
	let canvasContainer: HTMLDivElement;
	let height = 0;
	let scrubbing = false;
	let invalidateScrub = false;
	let latestScrubPosition = 0;

	const mouseDown = (e: MouseEvent) => {
		appState.mouseIsDown = true;
		scrubbing = true;
		const rect = canvasContainer.getBoundingClientRect();
		latestScrubPosition = e.clientX - rect.left;
		invalidateScrub = true;
	};

	const mouseMove = (e: MouseEvent) => {
		if (scrubbing) {
			const rect = canvasContainer.getBoundingClientRect();
			latestScrubPosition = e.clientX - rect.left;
			invalidateScrub = true;
		}
	};

	const mouseUp = (e: MouseEvent) => {
		appState.mouseIsDown = false;
		scrubbing = false;
	};

	const setCanvasSize = async () => {
		if (!context || !canvas) return;
		const dpr = window.devicePixelRatio;
		if (dpr !== 1) {
			canvas.height = height * dpr;
			canvas.width = programState.timelineWidth * dpr;
			canvas.style.height = `${height}px`;
			canvas.style.width = `${programState.timelineWidth}px`;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		} else {
			canvas.height = height;
			canvas.width = programState.timelineWidth;
		}

		await tick();
		drawSourceCanvas(context, programState.timelineWidth, height);
	};

	onFrame(() => {
		if (invalidateScrub) {
			invalidateScrub = false;
			setCurrentFrameFromOffset(latestScrubPosition);
			programState.invalidateTimeline = true;
		}
		if (programState.invalidateTimeline) {
			if (context) drawSourceCanvas(context, programState.timelineWidth, height);
			programState.invalidateTimeline = false;
		}
	});

	onMount(() => {
		if (!canvas || !canvasContainer) return;
		programState.timelineWidth = canvasContainer.clientWidth;
		height = canvasContainer.clientHeight;
		context = canvas.getContext('2d', { alpha: false });
		setCanvasSize();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="absolute w-full max-w-200 bottom-10 px-5 bg-[#09090a] rounded-4xl">
	<div class="h-12" bind:this={canvasContainer} onmousedown={mouseDown}>
		<canvas class="absolute" bind:this={canvas}></canvas>
	</div>
</div>

<svelte:window
	onmousemove={mouseMove}
	onmouseup={mouseUp}
	onresize={async () => {
		if (!canvasContainer || !context) return;
		programState.timelineWidth = canvasContainer.clientWidth;
		height = canvasContainer.clientHeight;
		setCanvasSize();

		drawSourceCanvas(context, programState.timelineWidth, height);
	}}
	onkeydown={(event) => {
		if (appState.disableKeyboardShortcuts) return;
		if (appState.showPalette) return;
		switch (event.code) {
			case 'KeyI':
				setInPoint();
				break;
			case 'KeyO':
				setOutPoint();
				break;
			case 'ArrowLeft':
				setCurrentFrame(programState.currentFrame - 1);
				break;
			case 'ArrowRight':
				setCurrentFrame(programState.currentFrame + 1);
				break;
		}
	}}
/>
