import { scaleToFill, scaleToFit } from '$lib/program/utils';
import { appState } from '$lib/state.svelte';
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
