import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source';
import { appState, timelineState } from '$lib/state.svelte';
import MediaWorker from './worker?worker';

export const setupRenderer = (canvas: HTMLCanvasElement) => {
	appState.mediaWorker = new MediaWorker();
	const offscreenCanvas = canvas.transferControlToOffscreen();

	appState.mediaWorker.postMessage(
		{
			command: 'initialize',
			canvas: offscreenCanvas
		},
		{ transfer: [offscreenCanvas] }
	);
};

export const sendFileToWorker = (source: Source) => {
	appState.mediaWorker?.postMessage({
		command: 'load-file',
		file: source.file,
		info: source.fileInfo
	});
};

export const updateWorkerClip = (clip: Clip | null) => {
	if (!clip) return;
	appState.mediaWorker?.postMessage({
		command: 'clip',
		frame: timelineState.currentFrame,
		clip: {
			id: clip.id,
			start: clip.start,
			duration: clip.duration,
			sourceOffset: clip.sourceOffset,
			scaleX: clip.scaleX,
			scaleY: clip.scaleY,
			positionX: clip.positionX,
			positionY: clip.positionY
		}
	});
};

export const seek = (frame: number) => {
	appState.mediaWorker?.postMessage({
		command: 'seek',
		frame
	});
};

// @ts-expect-error fds
window.play = (frame: number) => {
	appState.mediaWorker?.postMessage({
		command: 'play',
		frame: /* timelineState.currentFrame */ frame
	});
};

// @ts-expect-error fds
window.pause = () => {
	appState.mediaWorker?.postMessage({
		command: 'pause'
	});
};
