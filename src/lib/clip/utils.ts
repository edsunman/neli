import type { Clip } from './clip.svelte';

export const getClipInitialScaleFactor = (clip: Clip) => {
	const source = clip.source;
	const scaleX = 1920 / source.width;
	const scaleY = 1080 / source.height;
	// The final scaling factor is the smaller of the two
	const scaleFactor = Math.min(scaleX, scaleY);
	return Math.round(scaleFactor * 1000) / 1000;
};
