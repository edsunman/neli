import { getClipsAtFrame } from '$lib/clip/actions';
import { appState, programState, timelineState } from '$lib/state.svelte';
import { measureText } from '$lib/text/utils';

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

export const getClipAtCanvasPoint = (pointX: number, pointY: number) => {
	const clips = getClipsAtFrame(timelineState.currentFrame);
	for (const clip of clips) {
		if (clip.source.type === 'audio') continue;
		const box = { height: 0, width: 0, centerX: 0, centerY: 0 };
		if (clip.source.type === 'text') {
			const measurements = measureText(clip.text, appState.fonts[0], clip.params[7]);
			// scale factor based on font size and arbitrary number
			const scaleFactor = clip.params[6] / 9.3;
			box.width = measurements.width * scaleFactor;
			box.height = measurements.height * scaleFactor;
		} else if (clip.source.info.type === 'video' || clip.source.info.type === 'image') {
			box.width = clip.source.info.resolution.width * clip.params[0];
			box.height = clip.source.info.resolution.height * clip.params[1];
		} else if (clip.source.info.type === 'test') {
			box.width = 1920 * clip.params[0];
			box.height = 1080 * clip.params[1];
		}
		box.centerX = (clip.params[2] / 2 + 0.5) * programState.canvasWidth;
		box.centerY = (1 - (clip.params[3] / 2 + 0.5)) * programState.canvasHeight;
		if (
			pointX > box.centerX - box.width / 2 &&
			pointX < box.centerX + box.width / 2 &&
			pointY > box.centerY - box.height / 2 &&
			pointY < box.centerY + box.height / 2
		) {
			return clip;
		}
	}
};
