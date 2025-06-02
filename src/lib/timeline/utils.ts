import { timelineState } from '$lib/state.svelte';

export const canvasOffsetToFrame = (canvasOffset: number, includeOffset = true) => {
	const offset = includeOffset ? timelineState.offset : 0;
	const percentOfTimeline = canvasOffset / timelineState.width / timelineState.zoom + offset; // between 0 and 1
	//console.log(percentOfTimeline);
	return Math.floor(percentOfTimeline * timelineState.duration);
};

export const frameToCanvasOffset = (frame: number) => {
	const percentOfDuration = frame / timelineState.duration - timelineState.offset;
	//percentOfDuration = percentOfDuration + 0.5;
	return Math.floor(percentOfDuration * timelineState.width * timelineState.zoom);
};
