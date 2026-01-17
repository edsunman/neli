<script lang="ts">
	import { useAnimationFrame } from '$lib/hooks/useAnimationFrame';
	import { setCurrentFrameFromOffset } from '$lib/program/actions';
	import { appState, programState } from '$lib/state.svelte';
	import { drawSourceCanvas } from '$lib/timeline/canvas';
	import { onMount, tick } from 'svelte';

	const { onFrame } = useAnimationFrame();

	let canvas: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null;
	let canvasContainer: HTMLDivElement;
	let height = 0;
	let scrubbing = false;

	const mouseDown = (e: MouseEvent) => {
		appState.mouseIsDown = true;
		scrubbing = true;
	};

	const mouseMove = (e: MouseEvent) => {
		if (scrubbing) {
			const offsetX = e.clientX - canvasContainer.offsetLeft;
			setCurrentFrameFromOffset(offsetX);
			programState.invalidateTimeline = true;
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
<div class="h-14 flex-none bg-zinc-700" bind:this={canvasContainer} onmousedown={mouseDown}>
	<canvas class="absolute" bind:this={canvas}></canvas>
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
/>
