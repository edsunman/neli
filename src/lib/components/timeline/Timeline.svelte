<script lang="ts">
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import {
		setCurrentFrame,
		setCurrentFrameFromOffset,
		zoomOut,
		zoomIn,
		updateScrollPosition,
		setZoom,
		pause,
		play,
		focusTrack
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
		deleteClip,
		createClip,
		removeClip
	} from '$lib/clip/actions';
	import { drawCanvas, drawWaveform } from '$lib/timeline/canvas';
	import { canvasPixelToFrame, frameToCanvasPixel } from '$lib/timeline/utils';
	import { onMount, tick } from 'svelte';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';

	import Controls from './Controls.svelte';

	let { mouseMove = $bindable(), mouseUp = $bindable() } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let context: CanvasRenderingContext2D | null;
	let waveCanvas: OffscreenCanvas;
	let waveContext: OffscreenCanvasRenderingContext2D | null;
	let canvasContainer = $state<HTMLDivElement>();
	let height = $state(0);
	let scrubbing = false;
	let dragging = false;
	let resizing = false;
	let scrolling = false;
	let fontsLoaded = false;

	$effect(() => {
		// redraw on window resize
		innerHeight.current, innerWidth.current;
		if (waveContext) drawWaveform(waveContext);
		if (context) drawCanvas(context, timelineState.width, height, waveCanvas);
	});

	mouseMove = (e: MouseEvent, parentX: number, parentY: number) => {
		if (appState.mouseMoveOwner !== 'timeline') return;
		if (!canvas || !canvasContainer) return;

		canvas.style.cursor = 'default';
		const offsetY = parentY - canvasContainer.offsetTop;

		if (scrubbing) {
			setCurrentFrameFromOffset(parentX);
			timelineState.invalidate = true;
			return;
		}
		if (dragging || resizing || scrolling) {
			timelineState.dragOffset = parentX - timelineState.dragStart;
		}
		if (scrolling) {
			updateScrollPosition();
			timelineState.invalidateWaveform = true;
			return;
		}
		if (dragging) {
			moveSelectedClip(offsetY);
			timelineState.invalidateWaveform = true;
			return;
		}
		if (resizing) {
			resizeSelctedClip();
			canvas.style.cursor = 'col-resize';
			timelineState.invalidateWaveform = true;
			return;
		}

		if (offsetY < 0) return;
		timelineState.invalidate = true;

		timelineState.hoverClipId = '';
		const hoveredFrame = canvasPixelToFrame(e.offsetX);
		const clip = setHoverOnHoveredClip(hoveredFrame, offsetY);
		if (!clip) return;

		// hovering over a clip
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
		if (appState.disableKeyboardShortcuts) return;
		appState.mouseMoveOwner = 'timeline';
		appState.disableHoverStates = true;
		if (e.offsetY < 80) {
			scrubbing = true;
			setCurrentFrameFromOffset(e.offsetX);
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
			if (timelineState.playing) pause();
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
			clip.savedTrack = clip.track;

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

	mouseUp = (e: MouseEvent) => {
		const clip = timelineState.selectedClip;
		if (scrubbing) {
			scrubbing = false;
		}
		if (dragging) {
			dragging = false;
			if (clip) {
				trimSiblingClips(clip);
				updateWorkerClip(clip);
				if (clip.start !== clip.savedStart || clip.track !== clip.savedTrack) {
					historyManager.pushAction({
						action: 'moveClip',
						data: {
							clipId: clip.id,
							newStart: clip.start,
							oldStart: clip.savedStart,
							newTrack: clip.track,
							oldTrack: clip.savedTrack
						}
					});
				}
			}
		}
		if (resizing) {
			resizing = false;
			if (clip) {
				updateWorkerClip(clip);
				historyManager.newCommand({
					action: 'trimClip',
					data: {
						clipId: clip.id,
						newStart: clip.start,
						oldStart: clip.savedStart,
						newDuration: clip.duration,
						oldDuration: clip.savedDuration
					}
				});
			}
		}
		if (scrolling) {
			scrolling = false;
		}

		appState.disableHoverStates = false;
		timelineState.dragOffset = 0;
		historyManager.finishCommand();
		removeInvalidAllClips();
	};

	const dragEnter = (e: MouseEvent) => {
		e.preventDefault();
		const sourceId = appState.dragAndDropSourceId;
		if (!sourceId) return;
		const start = canvasPixelToFrame(e.offsetX);
		const newClip = createClip(sourceId, 0, start, 0, 0, true);
		if (!newClip) return;
		timelineState.selectedClip = newClip;
		timelineState.dragStart = e.offsetX;
	};

	const dragOver = (e: MouseEvent) => {
		e.preventDefault();
		timelineState.dragOffset = e.offsetX - timelineState.dragStart;
		moveSelectedClip(e.offsetY);
		timelineState.invalidateWaveform = true;
	};

	const dragLeave = () => {
		if (timelineState.selectedClip) {
			removeClip(timelineState.selectedClip.id);
			timelineState.invalidateWaveform = true;
		}
	};

	const drop = () => {
		const clip = timelineState.selectedClip;
		if (clip) {
			trimSiblingClips(clip);
			updateWorkerClip(clip);
			historyManager.pushAction({ action: 'addClip', data: { clipId: clip.id } });
			historyManager.finishCommand();
		}
	};

	const setCanvasWidth = async () => {
		if (!context || !canvas) return;
		const dpr = window.devicePixelRatio;
		if (dpr > 1) {
			canvas.height = height * dpr;
			canvas.width = timelineState.width * dpr;
			canvas.style.height = `${height}px`;
			canvas.style.width = `${timelineState.width}px`;
			context.setTransform(2, 0, 0, 2, 0, 0);
		} else {
			canvas.height = height;
			canvas.width = timelineState.width;
		}

		await tick();
		drawCanvas(context, timelineState.width, height, waveCanvas);
	};

	const step = () => {
		if (timelineState.invalidateWaveform) {
			if (waveContext) drawWaveform(waveContext);
			timelineState.invalidateWaveform = false;
			timelineState.invalidate = true;
		}
		if (timelineState.invalidate && fontsLoaded) {
			if (context) drawCanvas(context, timelineState.width, height, waveCanvas);
			timelineState.invalidate = false;
		}
		requestAnimationFrame(step);
	};
	requestAnimationFrame(step);

	onMount(async () => {
		await tick();
		if (!canvas) return;

		waveCanvas = new OffscreenCanvas(2000, 100);
		waveContext = waveCanvas.getContext('2d');

		context = canvas.getContext('2d', { alpha: false });

		setCanvasWidth();

		document.fonts.ready.then(() => {
			fontsLoaded = true;
			timelineState.invalidate = true;
		});

		// Can't add passive listeners in svelte
		canvasContainer?.addEventListener(
			'wheel',
			(e) => {
				e.preventDefault();
				if (!e.ctrlKey) return;
				if (e.deltaY > 50) zoomOut();
				if (e.deltaY < -50) zoomIn();
			},
			{ passive: false }
		);
	});
</script>

<div class="flex flex-col h-full">
	<Controls />
	<!-- svelte-ignore a11y_mouse_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="flex-1"
		role="navigation"
		onmousedown={mouseDown}
		ondragenter={dragEnter}
		ondragover={dragOver}
		ondragleave={dragLeave}
		ondrop={drop}
		bind:clientHeight={height}
		bind:clientWidth={timelineState.width}
		bind:this={canvasContainer}
	>
		<canvas bind:this={canvas}></canvas>
	</div>
</div>
<svelte:window
	onkeydown={(event) => {
		if (appState.disableKeyboardShortcuts) return;
		if (appState.showPalette) return;
		switch (event.code) {
			case 'Home':
				if (timelineState.playing) pause();
				setCurrentFrame(0);
				break;
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
			case 'Digit0':
				if (timelineState.zoom < 230.4) {
					setZoom(230.4);
				} else {
					setZoom(0.9);
				}
				break;
			case 'Space':
				event.preventDefault();
				if (timelineState.playing) {
					pause();
				} else {
					play();
				}
				break;
			case 'Backspace':
				const selectedClip = timelineState.selectedClip;
				if (!selectedClip) break;
				deleteClip(selectedClip.id);
				timelineState.invalidate = true;
				break;
			case 'KeyF': {
				if (timelineState.selectedClip) {
					if (timelineState.selectedClip.track === timelineState.focusedTrack) {
						focusTrack(0);
					} else {
						focusTrack(timelineState.selectedClip.track);
					}
				} else {
					focusTrack(0);
				}
			}
		}
	}}
/>
