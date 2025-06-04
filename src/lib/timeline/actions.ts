import { appState, Source, timelineState } from '$lib/state.svelte';
import { canvasPixelToFrame } from './utils';
import { VideoSource, Source as coreSource } from '@diffusionstudio/core';

export const setCurrentFrame = (frame: number) => {
	appState.composition?.seek(frame);
	//timelineState.currentFrame = frame;
};

export const setFrameFromOffset = (canvasOffset: number) => {
	timelineState.playing = false;
	let frame = canvasPixelToFrame(canvasOffset);
	if (frame > 8999) frame = 8999;
	setCurrentFrame(frame);
};

export const createSource = async (url: string) => {
	const videoSource = await coreSource.from<VideoSource>(url, { prefetch: false });
	appState.sources.push(new Source(videoSource));
};

export const getSourceFromId = (id: string) => {
	let foundSource;
	for (const source of appState.sources) {
		if (source.id === id) {
			foundSource = source;
		}
	}
	return foundSource;
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
