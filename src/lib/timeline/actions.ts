import { pauseWorker, playWorker, seekWorker } from '$lib/worker/actions';
import { audioDecoder, audioManager, timelineState } from '$lib/state.svelte';
import { canvasPixelToFrame } from './utils';
import { deselectClipIfTooSmall } from '$lib/clip/actions';

export const setCurrentFrame = (frame: number) => {
	if (frame < 0) frame = 0;
	if (frame > 8999) frame = 8999;
	seekWorker(frame);
	timelineState.currentFrame = frame;
	timelineState.invalidate = true;
};

export const setCurrentFrameFromOffset = (canvasOffset: number) => {
	timelineState.playing = false;
	const frame = canvasPixelToFrame(canvasOffset);
	setCurrentFrame(frame);
};

export const play = () => {
	timelineState.playing = true;

	playWorker(timelineState.currentFrame);
	audioDecoder.play(0);
	audioManager.play();

	const MS_PER_FRAME = 1000 / 30; // For 30 FPS
	let accumulator = 0;
	let lastTime = 0;
	let firstTimestamp = 0;

	const loop = (timestamp: number) => {
		if (!timelineState.playing) return;

		if (lastTime === 0) {
			lastTime = timestamp;
		}

		if (firstTimestamp === 0) {
			firstTimestamp = timestamp;
		}

		const deltaTime = timestamp - lastTime;
		lastTime = timestamp;

		accumulator += deltaTime;

		const oldFrame = timelineState.currentFrame;

		// the - 1 here is an 'epsilon' to make playback smoother
		while (accumulator >= MS_PER_FRAME - 1) {
			timelineState.currentFrame++;
			accumulator -= MS_PER_FRAME;
		}

		const elapsedTimeMs = timestamp - firstTimestamp;

		audioDecoder.run(elapsedTimeMs);
		audioManager.run();

		if (timelineState.currentFrame !== oldFrame) {
			timelineState.invalidate = true;
		}

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
