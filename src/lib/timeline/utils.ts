import { timelineState } from '$lib/state.svelte';

/**
 * Converts a pixel offset on the canvas to a frame number.
 *
 * @param canvasOffset The pixel offset from the left of the canvas.
 * @param includeOffset Set to false when calculating a range.
 * @returns The corresponding frame number.
 */
export const canvasPixelToFrame = (canvasOffset: number, includeOffset = true) => {
	const offset = includeOffset ? timelineState.offset : 0;
	const percentOfTimeline = canvasOffset / timelineState.width / timelineState.zoom + offset; // between 0 and 1
	return Math.floor(percentOfTimeline * timelineState.duration);
};

/**
 * Converts a frame number to a pixel offset on the canvas.
 *
 * @param frame The frame number to convert.
 * @param includeOffset Set to false when calculating a range.
 * @returns The corresponding pixel offset from the left of the canvas.
 */
export const frameToCanvasPixel = (frame: number, includeOffset = true) => {
	const offset = includeOffset ? timelineState.offset : 0;
	const percentOfDuration = frame / timelineState.duration - offset;
	return Math.floor(percentOfDuration * timelineState.width * timelineState.zoom);
};

export const secondsToTimecode = (seconds: number) => {
	const SS = seconds % 60;
	const minutes = (seconds - SS) / 60;
	const MM = minutes % 60;
	return String(MM).padStart(2, '0') + ':' + String(SS).padStart(2, '0');
};

export const framesToTimecode = (frames: number) => {
	const FF = frames % 30;
	const seconds = (timelineState.currentFrame - FF) / 30;
	const SS = seconds % 60;
	const minutes = (seconds - SS) / 60;
	const MM = minutes % 60;
	return (
		String(MM).padStart(2, '0') +
		':' +
		String(SS).padStart(2, '0') +
		':' +
		String(FF).padStart(2, '0')
	);
};
