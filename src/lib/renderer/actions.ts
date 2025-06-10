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
	let file: File | null = null;

	file = appState.sources[0].file;

	if (!file) return;

	appState.mediaWorker?.postMessage({
		command: 'decode',
		file: file
	});
};
