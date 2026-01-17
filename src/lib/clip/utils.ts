import type { Clip } from './clip.svelte';

export const getClipInitialScaleFactor = (clip: Clip) => {
	if (clip.source.info.type !== 'image' && clip.source.info.type !== 'video') return 0;

	const scaleX = 1920 / clip.source.info.resolution.width;
	const scaleY = 1080 / clip.source.info.resolution.height;
	// The final scaling factor is the smaller of the two
	const scaleFactor = Math.min(scaleX, scaleY);
	return Math.round(scaleFactor * 1000) / 1000;
};
