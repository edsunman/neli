import { timelineState } from '$lib/state.svelte';

export const canvasOffsetToFrame = (canvasOffset: number) => {
	const percentOfTimeline = canvasOffset / timelineState.width / timelineState.zoom; // between 0 and 1
	return Math.floor(percentOfTimeline * timelineState.duration);
};

export const frameToCanvasOffset = (frame: number) => {
	const percentOfDuration = frame / timelineState.duration;
	return Math.floor(percentOfDuration * timelineState.width * timelineState.zoom);
};
