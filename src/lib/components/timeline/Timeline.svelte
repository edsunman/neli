<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import {
		removeHoverAllClips,
		getClipFromId,
		moveSelectedClip,
		resizeSelctedClip,
		setClipHover,
		setCurrentFrame,
		setFrameFromOffset,
		updateClipCore,
		removeInvalidAllClips
	} from '$lib/timeline/actions';
	import { drawCanvas } from '$lib/timeline/canvas';
	import { canvasOffsetToFrame, frameToCanvasOffset } from '$lib/timeline/utils';
	import { onMount, tick } from 'svelte';
	import Controls from './Controls.svelte';

	let canvas = $state<HTMLCanvasElement>();
	let height = $state(0);
	let scrubbing = false;
	let dragging = false;
	let resizing = false;

	let context: CanvasRenderingContext2D | null;

	$effect(() => {
		// redraw when currentFrame changes
		timelineState.currentFrame;
		timelineState.invalidate = true;
	});

	const mouseMove = (e: MouseEvent) => {
		if (!canvas) return;
		timelineState.invalidate = true;
		canvas.style.cursor = 'default';
		if (scrubbing) {
			setFrameFromOffset(e.offsetX);
			return;
		}
		if (dragging || resizing) {
			timelineState.dragOffset = e.offsetX - timelineState.dragStart;
		}
		if (dragging) {
			moveSelectedClip();
			return;
		}
		if (resizing) {
			resizeSelctedClip();
			canvas.style.cursor = 'col-resize';
			return;
		}
		timelineState.hoverClipId = '';
		const hoveredFrame = canvasOffsetToFrame(e.offsetX);
		const clip = setClipHover(hoveredFrame, e.offsetY);
		if (!clip) return;

		clip.resizeHover = 'none';
		const start = frameToCanvasOffset(clip.start);
		const end = frameToCanvasOffset(clip.start + clip.duration);
		if (e.offsetX < start + 15) {
			canvas.style.cursor = 'col-resize';
			clip.resizeHover = 'start';
		} else if (e.offsetX > end - 15) {
			clip.resizeHover = 'end';
			canvas.style.cursor = 'col-resize';
		}
	};

	const mouseDown = (e: MouseEvent) => {
		if (e.offsetY < 40) {
			scrubbing = true;
		}
		if (timelineState.hoverClipId) {
			// clicked a clip
			const clip = getClipFromId(timelineState.hoverClipId);
			timelineState.selectedClip = clip;
			if (!clip) return;

			clip.savedStart = clip.start;
			clip.savedDuration = clip.duration;
			clip.savedSourceOffset = clip.sourceOffset;

			if (clip.resizeHover === 'start' || clip.resizeHover === 'end') {
				resizing = true;
				timelineState.dragStart = e.offsetX;
			} else {
				dragging = true;
				timelineState.dragStart = e.offsetX;
			}
		} else {
			timelineState.selectedClip = null;
		}
		removeHoverAllClips();
		timelineState.invalidate = true;
	};

	const mouseUp = (e: MouseEvent) => {
		if (scrubbing) {
			scrubbing = false;
			setFrameFromOffset(e.offsetX);
		}
		if (dragging) {
			updateClipCore();
			dragging = false;
		}
		if (resizing) {
			updateClipCore();
			resizing = false;
		}
		timelineState.dragOffset = 0;
		removeInvalidAllClips();
	};

	const mouseLeave = (e: MouseEvent) => {
		scrubbing = false;
	};

	const step = () => {
		if (timelineState.invalidate) {
			if (context) drawCanvas(context, timelineState.width, height);
			timelineState.invalidate = false;
		}
		requestAnimationFrame(step);
	};
	requestAnimationFrame(step);

	onMount(async () => {
		await tick();
		if (!canvas) return;

		context = canvas.getContext('2d', { alpha: false });
		if (!context) return;

		context.fillStyle = '#18181b';
		context.fillRect(0, 0, timelineState.width, height);
	});
</script>

<div class="flex flex-col h-full">
	<Controls />
	<!-- svelte-ignore a11y_mouse_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="basis-5/6 mb-8 mx-8"
		role="navigation"
		onmousemove={mouseMove}
		onmousedown={mouseDown}
		onmouseup={mouseUp}
		onmouseleave={mouseLeave}
		bind:clientHeight={height}
		bind:clientWidth={timelineState.width}
	>
		<canvas {height} width={timelineState.width} bind:this={canvas}></canvas>
	</div>
</div>
<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'ArrowLeft':
				setCurrentFrame(timelineState.currentFrame - 1);
				break;
			case 'ArrowRight':
				setCurrentFrame(timelineState.currentFrame + 2);
				break;
			case 'Minus':
				if (timelineState.zoom > 1) timelineState.zoom = timelineState.zoom / 2;
				timelineState.invalidate = true;
				break;
			case 'Equal':
				if (timelineState.zoom < 256) timelineState.zoom = timelineState.zoom * 2;
				timelineState.invalidate = true;
				break;
		}
	}}
/>
