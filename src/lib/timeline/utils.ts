import { timelineState } from '$lib/state.svelte';

export const canvasPixelToFrame = (canvasOffset: number, includeOffset = true) => {
	const offset = includeOffset ? timelineState.offset : 0;
	const percentOfTimeline = canvasOffset / timelineState.width / timelineState.zoom + offset; // between 0 and 1
	return Math.floor(percentOfTimeline * timelineState.duration);
};

export const frameToCanvasPixel = (frame: number) => {
	const percentOfDuration = frame / timelineState.duration - timelineState.offset;
	return Math.floor(percentOfDuration * timelineState.width * timelineState.zoom);
};

export const secondsToTimecode = (seconds: number) => {
	//const FF = frame % 30;
	//const seconds = (frame - FF) / 30;
	const SS = seconds % 60;
	const minutes = (seconds - SS) / 60;
	const MM = minutes % 60;
	return String(MM).padStart(2, '0') + ':' + String(SS).padStart(2, '0');
};
