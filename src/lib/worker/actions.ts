import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source';
import { appState, timelineState, audioManager } from '$lib/state.svelte';
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
			case 'audio-chunk': {
				audioManager.push(new Float32Array(event.data.audioData));
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
		scaleX: clip.scaleX,
		scaleY: clip.scaleY,
		positionX: clip.positionX,
		positionY: clip.positionY,
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

// @ts-expect-error fds
window.encode = async () => {
	const audioBuffer = await renderOfflineAudio();
	const f32Array = audioBuffer.getChannelData(0);
	//const buffer = f32Array.buffer;

	//console.log(buffer);

	appState.mediaWorker?.postMessage(
		{
			command: 'encode',
			audioBuffer: f32Array
		},
		[f32Array.buffer]
	);
};

async function renderOfflineAudio() {
	const sampleRate = 48000; // Standard sample rate
	const duration = 10; // seconds
	const numberOfChannels = 2; // Stereo

	// Create an OfflineAudioContext
	const offlineAudioContext = new OfflineAudioContext(
		numberOfChannels,
		sampleRate * duration,
		sampleRate
	);

	// Create an oscillator (or any other source/graph)
	const oscillator = offlineAudioContext.createOscillator();
	oscillator.frequency.value = 440; // A4 note
	oscillator.type = 'sine';

	// Create a gain node
	const gainNode = offlineAudioContext.createGain();
	gainNode.gain.value = 0.5;

	// Connect the graph
	oscillator.connect(gainNode);
	gainNode.connect(offlineAudioContext.destination);

	// Start the oscillator
	oscillator.start(0);
	oscillator.stop(duration); // Stop at the end of the rendering duration

	// Start rendering and await the result
	const renderedBuffer = await offlineAudioContext.startRendering();
	console.log('Offline rendering complete. AudioBuffer obtained.');
	return renderedBuffer;
}
