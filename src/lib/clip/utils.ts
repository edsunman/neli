import { scaleToFill, scaleToFit } from '$lib/program/utils';
import { appState, timelineState } from '$lib/state.svelte';
import type { KeyframeTrack } from '$lib/types';
import type { Clip } from './clip.svelte';

/** Get clip scale factor to 3 decimal places */
export const getClipFitTransform = (clip: Clip) => {
	if (
		clip.source.info.type !== 'image' &&
		clip.source.info.type !== 'video' &&
		clip.source.info.type !== 'test'
	)
		return { scale: 0, x: 0, y: 0 };

	const resolution = appState.project.resolution;
	const sourceWidth = clip.source.info.type === 'test' ? 1920 : clip.source.info.resolution.width;
	const sourceHeight = clip.source.info.type === 'test' ? 1080 : clip.source.info.resolution.height;

	const top = clip.params[12];
	const right = clip.params[13];
	const bottom = clip.params[14];
	const left = clip.params[15];

	const visibleWidthPercent = 1.0 - left - right;
	const visibleHeightPercent = 1.0 - top - bottom;
	const croppedWidth = sourceWidth * visibleWidthPercent;
	const croppedHeight = sourceHeight * visibleHeightPercent;

	const { scaleFactor } = scaleToFit(
		resolution.width,
		resolution.height,
		croppedWidth,
		croppedHeight
	);

	const visibleCenterX = left + visibleWidthPercent * 0.5;
	const visibleCenterY = top + visibleHeightPercent * 0.5;
	const offsetX = visibleCenterX - 0.5;
	const offsetY = visibleCenterY - 0.5;

	const canvasWidthOfImage = (sourceWidth / resolution.width) * 2.0 * scaleFactor;
	const canvasHeightOfImage = (sourceHeight / resolution.height) * 2.0 * scaleFactor;

	return {
		scale: roundTo(scaleFactor, 3),
		x: roundTo(-(offsetX * canvasWidthOfImage), 3),
		y: roundTo(offsetY * canvasHeightOfImage, 3)
	};
};

/**  Get clip scale factor to 3 decimal places */
export const getClipFillTransform = (clip: Clip) => {
	if (
		clip.source.info.type !== 'image' &&
		clip.source.info.type !== 'video' &&
		clip.source.info.type !== 'test'
	) {
		return { scale: 0, x: 0, y: 0 };
	}

	const resolution = appState.project.resolution;
	const sourceWidth = clip.source.info.type === 'test' ? 1920 : clip.source.info.resolution.width;
	const sourceHeight = clip.source.info.type === 'test' ? 1080 : clip.source.info.resolution.height;

	const top = clip.params[12];
	const right = clip.params[13];
	const bottom = clip.params[14];
	const left = clip.params[15];

	const visibleWidthPercent = 1.0 - left - right;
	const visibleHeightPercent = 1.0 - top - bottom;
	const croppedWidth = sourceWidth * visibleWidthPercent;
	const croppedHeight = sourceHeight * visibleHeightPercent;

	const { scaleFactor } = scaleToFill(
		resolution.width,
		resolution.height,
		croppedWidth,
		croppedHeight
	);

	const visibleCenterX = left + visibleWidthPercent * 0.5;
	const visibleCenterY = top + visibleHeightPercent * 0.5;
	const offsetX = visibleCenterX - 0.5;
	const offsetY = visibleCenterY - 0.5;

	const canvasWidthOfImage = (sourceWidth / resolution.width) * 2.0 * scaleFactor;
	const canvasHeightOfImage = (sourceHeight / resolution.height) * 2.0 * scaleFactor;

	return {
		scale: roundTo(scaleFactor, 3),
		x: roundTo(-(offsetX * canvasWidthOfImage), 3),
		y: roundTo(offsetY * canvasHeightOfImage, 3)
	};
};

export const getKeyframePositionHelpers = (clip: Clip, track: KeyframeTrack) => {
	const trackTop = timelineState.tracks[timelineState.focusedTrack - 1].top;

	// 1. Calculate Min/Max (O(n))
	let minVal = Infinity;
	let maxVal = -Infinity;

	const keyframes = track.keyframes;
	for (let i = 0; i < keyframes.length; i++) {
		const v = keyframes[i].value;
		if (v < minVal) minVal = v;
		if (v > maxVal) maxVal = v;
	}

	// 2. Resolve the "Flatline" vs "Range" logic
	const isFlat = maxVal === minVal;
	const range = isFlat ? 2 : maxVal - minVal;
	const displayMin = isFlat ? minVal - 1 : minVal;

	// 3. Return the pre-configured mappers
	return {
		getValY: (val: number) => trackTop + (110 - ((val - displayMin) / range) * 60),
		getFrameX: (f: number) =>
			Math.floor(
				((f + clip.start) / timelineState.duration - timelineState.offset) *
					timelineState.width *
					timelineState.zoom
			)
	};
};

export const roundTo = (value: number, decimals: number): number => {
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
};
