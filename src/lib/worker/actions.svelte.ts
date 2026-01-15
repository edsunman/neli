import { renderAudioForExport } from '$lib/audio/actions';
import type { Clip } from '$lib/clip/clip.svelte';
import { setSourceThumbnail } from '$lib/source/actions';
import type { Source } from '$lib/source/source.svelte';
import { appState, timelineState } from '$lib/state.svelte';
import { startPlayLoop } from '$lib/timeline/actions';
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
			case 'ready-to-play': {
				startPlayLoop();
				break;
			}
			case 'thumbnail': {
				if (event.data.videoFrame) {
					const videoFrame = event.data.videoFrame as VideoFrame;
					const imageData = createThumbnail(
						videoFrame,
						videoFrame.codedWidth,
						videoFrame.codedHeight
					);
					setSourceThumbnail(event.data.sourceId, imageData, 0);
				}

				if (event.data.bitmap) {
					const bitmap = event.data.bitmap as ImageBitmap;
					const imageData = createThumbnail(bitmap, bitmap.width, bitmap.height);
					setSourceThumbnail(event.data.sourceId, imageData, 0);
				}

				break;
			}
			case 'encode-progress': {
				if (event.data.percentComplete > -1) {
					appState.encoderProgress.percentage = event.data.percentComplete;
					if (event.data.percentComplete === 100) appState.exportSuccessCallback(true);
				} else {
					appState.exportSuccessCallback(false);
					appState.encoderProgress.percentage = 0;
					appState.encoderProgress.message = 'encoding failed';
					appState.encoderProgress.fail = true;
				}

				break;
			}
			case 'download-file': {
				console.log(event.data);
				const url = URL.createObjectURL(event.data.file);
				const a = document.createElement('a');
				a.href = url;
				a.download = event.data.fileName;
				a.style.display = 'none'; // Keep it hidden

				document.body.appendChild(a);
				a.click();

				document.body.removeChild(a);
				URL.revokeObjectURL(event.data.link); // Clean up the URL

				appState.encoderProgress.message = 'done';
				appState.encoderProgress.percentage = 100;

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
		type: source.type
	});
};

// TODO: updates should be batched together
// so multiple clip updates are sent in one message
export const updateWorkerClip = (clip: Clip | null) => {
	if (!clip) return;
	const workerClip: WorkerClip = {
		id: clip.id,
		sourceId: clip.source.id,
		sourceHeight: clip.source.height,
		sourceWidth: clip.source.width,
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

export const pauseWorker = (frame: number) => {
	appState.mediaWorker?.postMessage({
		command: 'pause',
		frame
	});
};

export const encode = async (fileName: string, startFrame: number, endFrame: number) => {
	const audioBuffer = await renderAudioForExport(startFrame, endFrame);
	appState.encoderProgress.message = 'encoding video...';
	appState.mediaWorker?.postMessage(
		{
			command: 'encode',
			fileName,
			audioBuffer,
			startFrame,
			endFrame
		},
		[audioBuffer.buffer]
	);
};

export const cancelEncode = () => {
	appState.encoderProgress.message = 'cancelling...';
	appState.mediaWorker?.postMessage({
		command: 'cancelEncode'
	});
};

function createThumbnail(image: ImageBitmap | VideoFrame, imageWidth: number, imageHeight: number) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not get 2D context from canvas');
	}

	// Thumbnail dimentions
	const targetW = 192;
	const targetH = 108;

	canvas.width = targetW;
	canvas.height = targetH;
	const inputRatio = imageWidth / imageHeight;
	const targetRatio = targetW / targetH;

	let drawW: number, drawH: number, offsetX: number, offsetY: number;

	if (inputRatio > targetRatio) {
		drawH = targetH;
		drawW = imageWidth * (targetH / imageHeight);
		offsetX = (targetW - drawW) / 2;
		offsetY = 0;
	} else {
		drawW = targetW;
		drawH = imageHeight * (targetW / imageWidth);
		offsetX = 0;
		offsetY = (targetH - drawH) / 2;
	}

	ctx.clearRect(0, 0, targetW, targetH);
	ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
	image.close();
	return canvas.toDataURL('image/webp', 0.8);
}
