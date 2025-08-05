import { renderAudio } from '$lib/audio/actions';
import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source';
import { appState, timelineState } from '$lib/state.svelte';
import type { WorkerClip } from '$lib/types';
import MediaWorker from './worker?worker';

export const setupWorker = (canvas: HTMLCanvasElement) => {
	appState.mediaWorker = new MediaWorker();
	const offscreenCanvas = canvas.transferControlToOffscreen();

	appState.mediaWorker.postMessage(
		{
			command: 'init',
			canvas: offscreenCanvas
		},
		{ transfer: [offscreenCanvas] }
	);
	appState.mediaWorker.addEventListener('message', (event) => {
		switch (event.data.command) {
			case 'download-link': {
				console.log(event.data);
				const a = document.createElement('a');
				a.href = event.data.link;
				a.download = 'download.mp4';
				a.style.display = 'none'; // Keep it hidden

				document.body.appendChild(a);
				a.click();

				document.body.removeChild(a);
				URL.revokeObjectURL(event.data.link); // Clean up the URL
				break;
			}
		}
	});
};

export const sendFileToWorker = (source: Source) => {
	appState.mediaWorker?.postMessage({
		command: 'load-file',
		id: source.id,
		file: source.file,
		info: source.fileInfo
	});
};

export const updateWorkerClip = (clip: Clip | null) => {
	if (!clip) return;
	const workerClip: WorkerClip = {
		id: clip.id,
		sourceId: clip.source.id,
		start: clip.start,
		duration: clip.duration,
		sourceOffset: clip.sourceOffset,
		params: $state.snapshot(clip.params),
		/* 		scaleX: clip.params[0],
		scaleY: clip.params[1],
		positionX: clip.params[2],
		positionY: clip.params[3], */
		type: clip.source.type,
		deleted: clip.deleted
	};
	appState.mediaWorker?.postMessage({
		command: 'clip',
		frame: timelineState.currentFrame,
		clip: workerClip
	});
};

export const seekWorker = (frame: number) => {
	appState.mediaWorker?.postMessage({
		command: 'seek',
		frame
	});
};

export const playWorker = (frame: number) => {
	appState.mediaWorker?.postMessage({
		command: 'play',
		frame
	});
};

export const pauseWorker = () => {
	appState.mediaWorker?.postMessage({
		command: 'pause'
	});
};

if (typeof window !== 'undefined') {
	// @ts-expect-error ???
	window.encode = async () => {
		const audioBuffer = await renderAudio();

		appState.mediaWorker?.postMessage(
			{
				command: 'encode',
				audioBuffer
			},
			[audioBuffer.buffer]
		);
	};
}
