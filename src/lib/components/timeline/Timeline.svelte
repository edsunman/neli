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
		focusTrack,
		focusClip,
		extendTimeline,
		setTrackPositions,
		addTrack,
		removeEmptyTracks
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
		removeClip,
		multiSelectClip,
		multiSelectClipsInRange,
		finaliseClip
	} from '$lib/clip/actions';
	import { drawCanvas, drawWaveform } from '$lib/timeline/canvas';
	import {
		calculateMaxZoomLevel,
		canvasPixelToFrame,
		frameToCanvasPixel
	} from '$lib/timeline/utils';
	import { onMount, tick } from 'svelte';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';

	import Controls from './Controls.svelte';
	import ContextMenu from '../ui/ContextMenu.svelte';
	import { mouseIcon } from '../icons/Icons.svelte';

	let { mouseMove = $bindable(), mouseUp = $bindable() } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let context: CanvasRenderingContext2D | null;
	let waveCanvas: OffscreenCanvas;
	let waveContext: OffscreenCanvasRenderingContext2D | null;
	let canvasContainer = $state<HTMLDivElement>();
	let scrubbing = false;
	let dragging = false;
	let resizing = false;
	let scrolling = false;
	let fontsLoaded = false;
	let contextMenu: ContextMenu;
	let clickedFrame = 0;

	const buttons = $state([
		{
			text: 'split clip',
			icon: null,
			onclick: () => {
				if (timelineState.selectedClip) {
					splitClip(timelineState.selectedClip.id, clickedFrame);
					timelineState.invalidateWaveform = true;
				}
			},
			shortcuts: ['shift', mouseIcon]
		},
		{
			text: 'focus clip',
			icon: null,
			onclick: () => focusClip(),
			shortcuts: ['shift', 'F']
		}
	]);

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
		if (dragging || resizing || scrolling || timelineState.action === 'selecting') {
			timelineState.dragOffset.x = parentX - timelineState.dragStart.x;
			timelineState.dragOffset.y = offsetY - timelineState.dragStart.y;
		}

		if (timelineState.action === 'selecting') {
			multiSelectClipsInRange();
			timelineState.invalidateWaveform = true;
			return;
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
		if (!clip || timelineState.selectedClips.size > 0) return;

		clip.resizeHover = 'none';
		const clipWidth = frameToCanvasPixel(clip.duration, false);
		if (clipWidth < 35) return;

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
		appState.mouseIsDown = true;
		timelineState.dragStart.x = e.offsetX;
		timelineState.dragStart.y = e.offsetY;
		if (e.button > 0) return;
		if (e.offsetY < (timelineState.height - 32) * 0.2) {
			scrubbing = true;
			setCurrentFrameFromOffset(e.offsetX);
		}
		const scrollBarStart = timelineState.offset * timelineState.width;
		const scrollBarEnd = scrollBarStart + timelineState.width / timelineState.zoom;
		if (
			e.offsetY > timelineState.height - 40 &&
			e.offsetX > scrollBarStart &&
			e.offsetX < scrollBarEnd
		) {
			scrolling = true;
			timelineState.offsetStart = timelineState.offset;
			return;
		}
		if (timelineState.hoverClipId) {
			// clicked a clip
			if (timelineState.playing) pause();
			const clip = getClip(timelineState.hoverClipId);
			if (!clip) return;

			if (timelineState.selectedClips.has(clip)) {
				// clicked a multi-selected clip
				for (const selectedClip of timelineState.selectedClips) {
					selectedClip.savedStart = selectedClip.start;
				}
				dragging = true;
				return;
			}

			if (e.shiftKey) {
				// if there is a clip selected check we have not clicked it
				if (timelineState.selectedClip === clip) return;
				multiSelectClip(timelineState.hoverClipId);
				return;
			}
			timelineState.selectedClip = clip;
			timelineState.selectedClips.clear();
			clip.savedStart = clip.start;
			clip.savedDuration = clip.duration;
			clip.savedSourceOffset = clip.sourceOffset;
			clip.savedTrack = clip.track;

			if (clip.resizeHover === 'start' || clip.resizeHover === 'end') {
				resizing = true;
			} else {
				dragging = true;
			}
		} else {
			timelineState.selectedClip = null;
			timelineState.selectedClips.clear();
			timelineState.action = 'selecting';
		}
		removeHoverAllClips();
		timelineState.invalidate = true;
	};

	mouseUp = () => {
		const clip = timelineState.selectedClip;
		if (scrubbing) {
			scrubbing = false;
		}
		if (dragging) {
			dragging = false;
			if (clip) {
				if (timelineState.trackDropZone > -1) {
					addTrack(timelineState.trackDropZone);
					clip.track = timelineState.trackDropZone + 1;
					timelineState.trackDropZone = -1;
					removeEmptyTracks();
				}
				finaliseClip(clip, 'moveClip');
				extendTimeline(clip.start + clip.duration);
			}
			if (timelineState.selectedClips.size > 0) {
				let endPoint = 0;
				for (const multiSelectClip of timelineState.selectedClips) {
					const end = multiSelectClip.start + multiSelectClip.duration;
					if (end > endPoint) endPoint = end;
					finaliseClip(multiSelectClip, 'moveClip');
				}
				extendTimeline(endPoint);
			}
		}
		if (resizing) {
			resizing = false;
			if (clip) finaliseClip(clip, 'trimClip');
		}
		if ((timelineState.action = 'selecting')) {
			if (timelineState.selectedClips.size === 1) {
				// if there is only one clip, select it
				const foundClip = timelineState.selectedClips.values().next().value;
				if (foundClip) timelineState.selectedClip = foundClip;
				timelineState.selectedClips.clear();
			}
		}
		if (scrolling) {
			scrolling = false;
		}
		timelineState.action = 'none';
		timelineState.invalidate = true;
		appState.mouseIsDown = false;
		timelineState.dragOffset.x = 0;
		timelineState.dragOffset.y = 0;
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
		timelineState.dragStart.x = e.offsetX;
	};

	const dragOver = (e: MouseEvent) => {
		e.preventDefault();
		timelineState.dragOffset.x = e.offsetX - timelineState.dragStart.x;
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

	const setCanvasSize = async () => {
		if (!context || !canvas || !waveCanvas) return;
		const dpr = window.devicePixelRatio;
		if (dpr !== 1) {
			canvas.height = timelineState.height * dpr;
			canvas.width = timelineState.width * dpr;
			canvas.style.height = `${timelineState.height}px`;
			canvas.style.width = `${timelineState.width}px`;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		} else {
			canvas.height = timelineState.height;
			canvas.width = timelineState.width;
		}

		waveCanvas.width = timelineState.width;
		setTrackPositions();

		await tick();
		drawCanvas(context, timelineState.width, timelineState.height, waveCanvas);
	};

	const step = () => {
		if (timelineState.invalidateWaveform) {
			if (waveContext) drawWaveform(waveContext, timelineState.width);
			timelineState.invalidateWaveform = false;
			timelineState.invalidate = true;
		}
		if (timelineState.invalidate && fontsLoaded) {
			if (context) drawCanvas(context, timelineState.width, timelineState.height, waveCanvas);
			timelineState.invalidate = false;
		}
		requestAnimationFrame(step);
	};
	requestAnimationFrame(step);

	onMount(() => {
		//await tick();
		if (!canvas || !canvasContainer) return;
		timelineState.width = document.body.clientWidth;
		timelineState.height = canvasContainer.clientHeight;
		waveCanvas = new OffscreenCanvas(timelineState.width, 100);
		waveContext = waveCanvas.getContext('2d');

		context = canvas.getContext('2d', { alpha: false });

		setCanvasSize();

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
		oncontextmenu={(e) => {
			e.preventDefault();
			timelineState.hoverClipId = '';
			const hoveredFrame = canvasPixelToFrame(e.offsetX);
			const clip = setHoverOnHoveredClip(hoveredFrame, e.offsetY);
			if (!clip) return;

			clickedFrame = hoveredFrame;
			timelineState.selectedClip = clip;
			timelineState.invalidate = true;

			contextMenu.openContextMenu(e);
		}}
		bind:this={canvasContainer}
	>
		<canvas class="absolute" bind:this={canvas}></canvas>
	</div>
</div>
<svelte:window
	onresize={async () => {
		if (!canvasContainer) return;
		timelineState.width = document.body.clientWidth;
		timelineState.height = canvasContainer?.clientHeight;
		setCanvasSize();

		if (waveContext) drawWaveform(waveContext, timelineState.width);
		if (context) drawCanvas(context, timelineState.width, timelineState.height, waveCanvas);
	}}
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
				if (event.ctrlKey) break;
				zoomOut();
				break;
			case 'Equal':
				if (event.ctrlKey) break;
				zoomIn();
				break;
			case 'Digit0':
				const maxZoom = calculateMaxZoomLevel();
				if (timelineState.zoom < maxZoom) {
					setZoom(maxZoom);
				} else {
					setZoom(0.9);
				}
				break;
			case 'Space':
				event.preventDefault();
				if (timelineState.playing) {
					pause();
				} else if (!appState.mouseIsDown) {
					play();
				}
				break;
			case 'Backspace':
				if (timelineState.selectedClip) deleteClip(timelineState.selectedClip);
				if (timelineState.selectedClips) {
					for (const clip of timelineState.selectedClips) {
						deleteClip(clip);
					}
				}
				historyManager.finishCommand();
				timelineState.invalidateWaveform = true;
				break;
			case 'KeyF': {
				if (timelineState.selectedClip) {
					if (event.shiftKey) {
						focusClip();
					} else {
						if (timelineState.selectedClip.track === timelineState.focusedTrack) {
							focusTrack(0);
						} else {
							focusTrack(timelineState.selectedClip.track);
						}
					}
				} else {
					focusTrack(0);
				}
			}
		}
	}}
/>

<ContextMenu bind:this={contextMenu} {buttons} />
