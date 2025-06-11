import { appState } from '$lib/state.svelte';
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

export const sendFileToWorker = () => {
	appState.mediaWorker?.postMessage({
		command: 'load-file',
		file: appState.sources[0].file,
		info: appState.sources[0].fileInfo
	});
};

export const seek = (frame: number) => {
	appState.mediaWorker?.postMessage({
		command: 'seek',
		targetFrame: frame
	});
};

// @ts-expect-error fds
window.seek = (n: number) => {
	appState.mediaWorker?.postMessage({
		command: 'seek',
		targetFrame: n
	});
};
