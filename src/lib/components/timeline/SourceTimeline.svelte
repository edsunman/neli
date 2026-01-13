<script lang="ts">
	import { setCurrentFrameFromOffset } from '$lib/program/actions';
	import { programState } from '$lib/state.svelte';
	import { drawSourceCanvas } from '$lib/timeline/canvas';
	import { onDestroy, onMount, tick, type MountOptions } from 'svelte';

	let { mouseMove = $bindable(), mouseUp = $bindable() } = $props();

	let canvas: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null;
	let canvasContainer: HTMLDivElement;
	let height = 0;
	let scrubbing = false;
	let rafId: number;

	const mouseDown = (e: MouseEvent) => {
		scrubbing = true;
	};

	mouseMove = (e: MouseEvent) => {
		if (scrubbing) {
			const rect = canvasContainer.getBoundingClientRect();
			const offsetX = e.clientX - rect.left;
			setCurrentFrameFromOffset(offsetX);
			programState.invalidateTimeline = true;
		}
	};

	mouseUp = (e: MouseEvent) => {
		scrubbing = false;
		//console.log(e.offsetX);
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

	const step = () => {
		if (programState.invalidateTimeline) {
			if (context) drawSourceCanvas(context, programState.timelineWidth, height);
			programState.invalidateTimeline = false;
		}
		rafId = requestAnimationFrame(step);
	};
	requestAnimationFrame(step);

	onMount(() => {
		if (!canvas || !canvasContainer) return;
		programState.timelineWidth = canvasContainer.clientWidth;
		height = canvasContainer.clientHeight;
		context = canvas.getContext('2d', { alpha: false });
		setCanvasSize();
	});

	onDestroy(() => {
		if (rafId) window.cancelAnimationFrame(rafId);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="h-14 flex-none bg-zinc-700" bind:this={canvasContainer} onmousedown={mouseDown}>
	<canvas class="absolute" bind:this={canvas}></canvas>
</div>

<svelte:window
	onresize={async () => {
		if (!canvasContainer || !context) return;
		programState.timelineWidth = canvasContainer.clientWidth;
		height = canvasContainer.clientHeight;
		setCanvasSize();

		drawSourceCanvas(context, programState.timelineWidth, height);
	}}
/>
