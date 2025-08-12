import { renderAudioForExport } from '$lib/audio/actions';
import type { Clip } from '$lib/clip/clip.svelte';
import { setSourceThumbnail } from '$lib/source/actions';
import type { Source } from '$lib/source/source.svelte';
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
	appState.mediaWorker.addEventListener('message', async (event) => {
		switch (event.data.command) {
			case 'thumbnail': {
				const videoFrame = event.data.videoFrame;
				const canvas = document.createElement('canvas');
				canvas.width = videoFrame.codedWidth * 0.1;
				canvas.height = videoFrame.codedHeight * 0.1;

				const ctx = canvas.getContext('2d');
				ctx?.drawImage(videoFrame, 0, 0, videoFrame.codedWidth * 0.1, videoFrame.codedHeight * 0.1);

				videoFrame.close();

				const imgData = canvas.toDataURL('image/webp', 0.8);

				setSourceThumbnail(event.data.sourceId, imgData, event.data.gap);
				break;
			}
			case 'encode-progress': {
				if (event.data.percentComplete > -1) {
					appState.encoderProgress.percentage = event.data.percentComplete;
				} else {
					appState.encoderProgress.percentage = 0;
					appState.encoderProgress.message = 'encoding failed';
					appState.encoderProgress.fail = true;
				}

				break;
			}
			case 'download-link': {
				console.log(event.data);
				const a = document.createElement('a');
				a.href = event.data.link;
				a.download = event.data.fileName;
				a.style.display = 'none'; // Keep it hidden

				document.body.appendChild(a);
				a.click();

				document.body.removeChild(a);
				URL.revokeObjectURL(event.data.link); // Clean up the URL

				appState.encoderProgress.message = 'done';
				appState.encoderProgress.percentage = 100;
				appState.lockPalette = false;
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
		track: clip.track,
		params: $state.snapshot(clip.params),
		text: clip.text,
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

export const encode = async (fileName: string) => {
	const audioBuffer = await renderAudioForExport();
	appState.encoderProgress.message = 'encoding video...';
	appState.mediaWorker?.postMessage(
		{
			command: 'encode',
			fileName,
			audioBuffer
		},
		[audioBuffer.buffer]
	);
};
