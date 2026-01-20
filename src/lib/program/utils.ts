import { programState } from '$lib/state.svelte';

/**
 * Calculates a new resolution to fit source dimensions inside target dimensions
 * while maintaining the original aspect ratio.
 */
export const scaleToFit = (
	targetWidth: number,
	targetHeight: number,
	sourceWidth: number,
	sourceHeight: number
) => {
	const widthRatio = targetWidth / sourceWidth;
	const heightRatio = targetHeight / sourceHeight;
	const scaleFactor = Math.min(widthRatio, heightRatio);
	return {
		width: Math.round(sourceWidth * scaleFactor),
		height: Math.round(sourceHeight * scaleFactor),
		scaleFactor
	};
};

/**
 * Calculates a new resolution to fill target dimensions with source dimensions
 * while maintaining the original aspect ratio.
 */
export const scaleToFill = (
	targetWidth: number,
	targetHeight: number,
	sourceWidth: number,
	sourceHeight: number
) => {
	const widthRatio = targetWidth / sourceWidth;
	const heightRatio = targetHeight / sourceHeight;
	const scaleFactor = Math.max(widthRatio, heightRatio);
	return {
		width: Math.round(sourceWidth * scaleFactor),
		height: Math.round(sourceHeight * scaleFactor),
		scaleFactor
	};
};

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
