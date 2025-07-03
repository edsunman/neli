import { pauseWorker, playWorker, seekWorker } from '$lib/worker/actions';
import { audioManager, timelineState } from '$lib/state.svelte';
import { canvasPixelToFrame } from './utils';
import { deselectClipIfTooSmall } from '$lib/clip/actions';

export const setCurrentFrame = (frame: number) => {
	seekWorker(frame);
	timelineState.currentFrame = frame;
	timelineState.invalidate = true;
};

export const setCurrentFrameFromOffset = (canvasOffset: number) => {
	timelineState.playing = false;
	let frame = canvasPixelToFrame(canvasOffset);
	if (frame < 0) frame = 0;
	if (frame > 8999) frame = 8999;
	setCurrentFrame(frame);
};

export const play = () => {
	timelineState.playing = true;

	playWorker(timelineState.currentFrame);
	/* const intervalMs = (1024 / 48000) * 1000 * 0.8;
	console.log('interval ', intervalMs); */

	audioManager.play();

	let firstTimestamp = -1;
	let previousFrame = -1;

	const startingFrame = timelineState.currentFrame;

	const loop = (timestamp: number) => {
		if (!timelineState.playing) return;
		if (firstTimestamp < 0) {
			firstTimestamp = timestamp;
		}
		const elapsedTimeMs = timestamp - firstTimestamp;
		const targetFrame = Math.round((elapsedTimeMs / 1000) * 30) + startingFrame;

		audioManager.run();

		if (targetFrame === previousFrame) {
			self.requestAnimationFrame(loop);
			return;
		}

		timelineState.currentFrame = targetFrame;
		timelineState.invalidate = true;

		previousFrame = targetFrame;
		if (timelineState.playing) requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
};

export const pause = () => {
	timelineState.playing = false;
	pauseWorker();
	audioManager.pause();
};

export const centerViewOnPlayhead = () => {
	const playheadPercent = timelineState.currentFrame / timelineState.duration;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	timelineState.offset = playheadPercent - percentOfTimelineVisible / 2;
};

export const checkViewBounds = () => {
	const padding = 0.05 / timelineState.zoom;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	const maxPercentAllowed = 1 - percentOfTimelineVisible;
	if (timelineState.offset < 0) {
		timelineState.offset = 0 - padding;
	}
	if (timelineState.offset > maxPercentAllowed + padding)
		timelineState.offset = maxPercentAllowed + padding;
};

export const zoomIn = () => {
	if (timelineState.zoom < 220) timelineState.zoom = timelineState.zoom * 2;
	centerViewOnPlayhead();
	checkViewBounds();
	timelineState.invalidate = true;
};

export const zoomOut = () => {
	if (timelineState.zoom > 0.9) {
		const center = timelineState.offset + 0.5 / timelineState.zoom;
		timelineState.zoom = timelineState.zoom / 2;
		timelineState.offset = center - 0.5 / timelineState.zoom;
	}
	checkViewBounds();
	deselectClipIfTooSmall();
	timelineState.invalidate = true;
};

export const setZoom = (zoomAmount: number) => {
	timelineState.zoom = zoomAmount;
	centerViewOnPlayhead();
	checkViewBounds();
	timelineState.invalidate = true;
};

export const updateScrollPosition = () => {
	const padding = 0.05 / timelineState.zoom;
	const offsetPercent = timelineState.dragOffset / timelineState.width;
	timelineState.offset = timelineState.offsetStart + offsetPercent;
	if (timelineState.offset < 0 - padding) timelineState.offset = 0 - padding;
	const barWidth = 1 / timelineState.zoom;
	if (timelineState.offset + barWidth >= 1 + padding) timelineState.offset = 1 - barWidth + padding;
};
