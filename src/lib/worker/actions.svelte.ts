import { renderAudioForExport } from '$lib/audio/actions';
import type { Clip } from '$lib/clip/clip.svelte';
import { startProgramPlayLoop } from '$lib/program/actions';
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
				if (appState.selectedSource) {
					startProgramPlayLoop();
				} else {
					startPlayLoop();
				}
				break;
			}
			case 'thumbnail': {
				if (event.data.videoFrame) {
					const videoFrame = event.data.videoFrame as VideoFrame;
					const imageData = await createThumbnail(
						videoFrame,
						videoFrame.codedWidth,
						videoFrame.codedHeight
					);
					setSourceThumbnail(event.data.sourceId, imageData, event.data.gap);
				}

				if (event.data.bitmap) {
					const bitmap = event.data.bitmap as ImageBitmap;
					const imageData = await createThumbnail(bitmap, bitmap.width, bitmap.height);
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

// TODO: updates should be batched together so multiple clip updates are sent in one message
// Also do we really need to send everything or can we decide what to send?
export const updateWorkerClip = (clip: Clip | null) => {
	if (!clip) return;
	let height = 0;
	let width = 0;
	if (clip.source.info.type === 'video' || clip.source.info.type === 'image') {
		height = clip.source.info.resolution.height;
		width = clip.source.info.resolution.width;
	}
	const workerClip: WorkerClip = {
		id: clip.id,
		sourceId: clip.source.id,
		sourceHeight: height,
		sourceWidth: width,
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

export const resizeWorkerCanvas = (width: number, height: number) => {
	appState.mediaWorker?.postMessage({
		command: 'resizeCanvas',
		width,
		height,
		frame: timelineState.currentFrame
	});
};

export const showAudioSource = () => {
	appState.mediaWorker?.postMessage({
		command: 'showAudioSource'
	});
};

export const showSource = (
	sourceId: string,
	frame: number,
	image = false,
	imageHeight = 0,
	imageWidth = 0
) => {
	appState.mediaWorker?.postMessage({
		command: 'showSource',
		sourceId,
		frame,
		image,
		imageHeight,
		imageWidth
	});
};

export const showTimeline = () => {
	appState.mediaWorker?.postMessage({
		command: 'showTimeline',
		width: appState.project.resolution.width,
		height: appState.project.resolution.height,
		frame: timelineState.currentFrame
	});
};

const createThumbnail = async (
	image: ImageBitmap | VideoFrame,
	imageWidth: number,
	imageHeight: number
) => {
	const targetWidth = 192;
	const targetHeight = 108;

	const canvas = new OffscreenCanvas(targetWidth, targetHeight);
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not get 2D context from canvas');
	}

	const inputRatio = imageWidth / imageHeight;
	const targetRatio = targetWidth / targetHeight;
	let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

	if (inputRatio > targetRatio) {
		drawHeight = targetHeight;
		drawWidth = imageWidth * (targetHeight / imageHeight);
		offsetX = (targetWidth - drawWidth) / 2;
		offsetY = 0;
	} else {
		drawWidth = targetWidth;
		drawHeight = imageHeight * (targetWidth / imageWidth);
		offsetX = 0;
		offsetY = (targetHeight - drawHeight) / 2;
	}

	context.clearRect(0, 0, targetWidth, targetHeight);
	context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
	image.close();

	const blob = await canvas.convertToBlob({ type: 'image/png' });

	const db: IDBDatabase = await new Promise((resolve, reject) => {
		const request = indexedDB.open('ImageStorage', 1);
		request.onupgradeneeded = () => request.result.createObjectStore('images');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction('images', 'readwrite');
		tx.objectStore('images').put(blob, 'hello');
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});

	return URL.createObjectURL(blob);
};
