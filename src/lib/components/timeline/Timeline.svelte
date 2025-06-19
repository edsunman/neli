<script lang="ts">
	import { timelineState } from '$lib/state.svelte';
	import {
		setCurrentFrame,
		setFrameFromOffset,
		zoomOut,
		zoomIn,
		updateScrollPosition
	} from '$lib/timeline/actions';
	import {
		removeHoverAllClips,
		getClip,
		moveSelectedClip,
		resizeSelctedClip,
		setHoverOnHoveredClip,
		removeInvalidAllClips,
		trimSiblingClips,
		splitClip,
		deleteClip
	} from '$lib/clip/actions';
	import { drawCanvas } from '$lib/timeline/canvas';
	import { canvasPixelToFrame, frameToCanvasPixel } from '$lib/timeline/utils';
	import { onMount, tick } from 'svelte';
	import Controls from './Controls.svelte';
	import { updateWorkerClip } from '$lib/renderer/actions';

	let canvas = $state<HTMLCanvasElement>();
	let height = $state(0);
	let scrubbing = false;
	let dragging = false;
	let resizing = false;
	let scrolling = false;
	let fontsLoaded = false;

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
		if (dragging || resizing || scrolling) {
			timelineState.dragOffset = e.offsetX - timelineState.dragStart;
		}
		if (scrolling) {
			updateScrollPosition();
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
		const hoveredFrame = canvasPixelToFrame(e.offsetX);
		const clip = setHoverOnHoveredClip(hoveredFrame, e.offsetY);
		if (!clip) return;

		clip.resizeHover = 'none';
		const start = frameToCanvasPixel(clip.start);
		const end = frameToCanvasPixel(clip.start + clip.duration);
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
		const scrollBarStart = timelineState.offset * timelineState.width;
		const scrollBarEnd = scrollBarStart + timelineState.width / timelineState.zoom;
		if (e.offsetY > height - 60 && e.offsetX > scrollBarStart && e.offsetX < scrollBarEnd) {
			scrolling = true;
			timelineState.dragStart = e.offsetX;
			timelineState.offsetStart = timelineState.offset;
		}
		if (timelineState.hoverClipId) {
			// clicked a clip
			if (e.shiftKey) {
				splitClip(timelineState.hoverClipId, canvasPixelToFrame(e.offsetX));
				timelineState.invalidate = true;
				return;
			}

			const clip = getClip(timelineState.hoverClipId);
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
			dragging = false;
			trimSiblingClips();
			updateWorkerClip(timelineState.selectedClip);
		}
		if (resizing) {
			resizing = false;
			updateWorkerClip(timelineState.selectedClip);
		}
		if (scrolling) {
			scrolling = false;
		}
		timelineState.dragOffset = 0;
		removeInvalidAllClips();
	};

	const mouseLeave = (e: MouseEvent) => {
		mouseUp(e);
	};

	const step = () => {
		if (timelineState.invalidate && fontsLoaded) {
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

		document.fonts.ready.then(() => {
			fontsLoaded = true;
			timelineState.invalidate = true;
		});
	});
</script>

<div class="flex flex-col h-full">
	<Controls />
	<!-- svelte-ignore a11y_mouse_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="flex-1"
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
				setCurrentFrame(timelineState.currentFrame + 1);
				break;
			case 'Minus':
				zoomOut();
				break;
			case 'Equal':
				zoomIn();
				break;
			case 'Backspace':
				const selectedClip = timelineState.selectedClip;
				if (!selectedClip) break;
				deleteClip(selectedClip.id);
				timelineState.invalidate = true;
				break;
		}
	}}
/>
