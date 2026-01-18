import { programState } from '$lib/state.svelte';
import type { Clip } from './clip.svelte';

export const getClipInitialScaleFactor = (clip: Clip) => {
	if (
		clip.source.info.type !== 'image' &&
		clip.source.info.type !== 'video' &&
		clip.source.info.type !== 'test'
	)
		return 0;

	const width = clip.source.info.type === 'test' ? 1920 : clip.source.info.resolution.width;
	const height = clip.source.info.type === 'test' ? 1080 : clip.source.info.resolution.height;

	const scaleX = programState.canvasWidth / width;
	const scaleY = programState.canvasHeight / height;

	const scaleFactor = Math.min(scaleX, scaleY);
	return Math.round(scaleFactor * 1000) / 1000;
};
