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

/** Returns format MM:SS */
export const secondsToTimecode = (seconds: number) => {
	const SS = seconds % 60;
	const minutes = (seconds - SS) / 60;
	const MM = minutes % 60;
	return String(MM).padStart(2, '0') + ':' + String(SS).padStart(2, '0');
};

/** Returns format MM:SS:FF */
export const framesToTimecode = (frames: number) => {
	const FF = frames % 30;
	const seconds = (frames - FF) / 30;
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

export const stringToFramesAndSynopsis = (
	timeString: string
): { frames: number; synopsis: string } => {
	const framesPerSecond = 30;
	const lowerCaseString = timeString.toLowerCase();

	let frames = 0;
	let synopsis = '';

	if (lowerCaseString.includes(':') || lowerCaseString.includes('.')) {
		const separator = lowerCaseString.includes(':') ? ':' : '.';
		const parts = lowerCaseString.split(separator).map((part) => parseInt(part, 10));
		const validParts = parts.map((part) => (isNaN(part) ? 0 : part));

		if (validParts.length === 2) {
			const minutes = validParts[0];
			const seconds = validParts[1];
			frames = (minutes * 60 + seconds) * framesPerSecond;
			synopsis = `seek to ${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
		} else if (validParts.length >= 3) {
			const minutes = validParts[0];
			const seconds = validParts[1];
			const extraFrames = validParts[2];
			frames = (minutes * 60 + seconds) * framesPerSecond + extraFrames;
			synopsis = `seek to ${minutes} minute${minutes !== 1 ? 's' : ''}, ${seconds} second${seconds !== 1 ? 's' : ''}, and ${extraFrames} frame${extraFrames !== 1 ? 's' : ''}`;
		} else {
			return { frames: 0, synopsis: 'seek to 0 frames' };
		}
	} else {
		const numericPart = parseFloat(lowerCaseString);
		const unitPart = lowerCaseString.replace(numericPart.toString(), '').trim();
		const value = isNaN(numericPart) ? 0 : numericPart;

		if (unitPart === 'm') {
			frames = value * 60 * framesPerSecond;
			synopsis = `seek to ${value} minute${value !== 1 ? 's' : ''}`;
		} else if (unitPart === 'f') {
			frames = value;
			synopsis = `seek to frame ${value}`;
		} else {
			frames = value * framesPerSecond;
			synopsis = `seek to ${value} second${value !== 1 ? 's' : ''}`;
		}
	}

	return { frames, synopsis };
};

export const calculateMaxZoomLevel = () => {
	const framePixelWidth = 50;
	const basePixelsPerFrame = timelineState.width / timelineState.duration;
	return framePixelWidth / basePixelsPerFrame;
};
