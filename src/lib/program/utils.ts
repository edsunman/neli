import { programState } from '$lib/state.svelte';

export const programTimelinePixelToFrame = (canvasOffset: number) => {
	// assume 10 px padding
	const percentOfTimeline = (canvasOffset - 10) / (programState.timelineWidth - 20); // between 0 and 1
	return Math.floor(percentOfTimeline * programState.duration);
};

export const programFrameToCanvasPixel = (frame: number) => {
	// assume 10 px padding
	const percentOfDuration = frame / programState.duration;
	return Math.floor(percentOfDuration * (programState.timelineWidth - 20)) + 10;
};
