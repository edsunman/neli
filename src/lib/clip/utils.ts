import { scaleToFill, scaleToFit } from '$lib/program/utils';
import { appState, timelineState } from '$lib/state.svelte';
import type { KeyframeTrack } from '$lib/types';
import type { Clip } from './clip.svelte';

/** Get clip scale factor to 2 decimal places */
export const getClipFitScaleFactor = (clip: Clip) => {
	if (
		clip.source.info.type !== 'image' &&
		clip.source.info.type !== 'video' &&
		clip.source.info.type !== 'test'
	)
		return 0;
	const resolution = appState.project.resolution;
	const width = clip.source.info.type === 'test' ? 1920 : clip.source.info.resolution.width;
	const height = clip.source.info.type === 'test' ? 1080 : clip.source.info.resolution.height;
	const { scaleFactor } = scaleToFit(resolution.width, resolution.height, width, height);
	return Math.round(scaleFactor * 1000) / 1000;
};

/**  Get clip scale factor to 2 decimal places */
export const getClipFillScaleFactor = (clip: Clip) => {
	if (
		clip.source.info.type !== 'image' &&
		clip.source.info.type !== 'video' &&
		clip.source.info.type !== 'test'
	)
		return 0;
	const resolution = appState.project.resolution;
	const width = clip.source.info.type === 'test' ? 1920 : clip.source.info.resolution.width;
	const height = clip.source.info.type === 'test' ? 1080 : clip.source.info.resolution.height;
	const { scaleFactor } = scaleToFill(resolution.width, resolution.height, width, height);
	return Math.round(scaleFactor * 1000) / 1000;
};

export const getKeyframePositionHelpers = (clip: Clip, track: KeyframeTrack) => {
	const trackTop = timelineState.tracks[timelineState.focusedTrack - 1].top;

	// 1. Calculate Min/Max (O(n))
	let minVal = Infinity;
	let maxVal = -Infinity;
	for (const v of track.values) {
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
