import MediaWorker from './worker?worker';
import WaveformWorker from './waveformWorker?worker';
import { appState, timelineState } from '$lib/state.svelte';
import { setSourceThumbnail } from '$lib/source/actions';
import { startProgramPlayLoop } from '$lib/program/actions';
import { startPlayLoop } from '$lib/timeline/actions';
import { createThumbnail } from './actions';

import type { Source } from '$lib/source/source.svelte';
import type { Clip } from '$lib/clip/clip.svelte';
import type { WorkerClip } from '$lib/types';

export class WorkerManager {
	private mediaWorker: Worker | undefined;
	private waveformWorker: Worker | undefined;

	setup(canvas: HTMLCanvasElement) {
		this.mediaWorker = new MediaWorker();
		this.waveformWorker = new WaveformWorker();
		const offscreenCanvas = canvas.transferControlToOffscreen();

		this.mediaWorker.postMessage(
			{
				command: 'init',
				canvas: offscreenCanvas
			},
			{ transfer: [offscreenCanvas] }
		);

		this.mediaWorker.addEventListener('message', this.mediaWorkerListner);
		this.waveformWorker.addEventListener('message', this.waveformWorkerListner);
	}

	reset() {
		this.send('reset');
	}

	sendFile(source: Source) {
		this.send('load-file', { id: source.id, file: source.file, type: source.type });
	}

	sendClip(input: Clip | Clip[]) {
		const clips = Array.isArray(input) ? input : [input];
		if (clips.length === 0) return;

		const workerClips: WorkerClip[] = clips.map((clip) => {
			const info = clip.source.info;
			const isVisual = info.type === 'video' || info.type === 'image';
			return {
				id: clip.id,
				sourceId: clip.source.id,
				sourceHeight: isVisual ? info.resolution.height : 0,
				sourceWidth: isVisual ? info.resolution.width : 0,
				start: clip.start,
				duration: clip.duration,
				sourceOffset: clip.sourceOffset,
				track: clip.track,
				params: $state.snapshot(clip.params),
				text: clip.text,
				type: clip.source.type,
				deleted: clip.deleted
			};
		});

		this.send('clip', { frame: timelineState.currentFrame, clips: workerClips });
	}

	seek(frame: number) {
		this.send('seek', { frame });
	}

	play(frame: number) {
		this.send('play', { frame });
	}

	pause(frame: number) {
		this.send('pause', { frame });
	}

	encode(fileName: string, startFrame: number, endFrame: number, audioBuffer: Float32Array) {
		this.send('encode', { fileName, audioBuffer, startFrame, endFrame }, [audioBuffer.buffer]);
	}

	cancelEncode() {
		this.send('cancelEncode');
	}

	resizeCanvas(width: number, height: number) {
		this.send('resizeCanvas', { width, height, frame: timelineState.currentFrame });
	}

	showAudioSource() {
		this.send('showAudioSource');
	}

	showSource(sourceId: string, frame: number, image = false, imageHeight = 0, imageWidth = 0) {
		this.send('showSource', {
			sourceId,
			frame,
			image,
			imageHeight,
			imageWidth
		});
	}

	showTimeline() {
		this.send('showTimeline', {
			width: appState.project.resolution.width,
			height: appState.project.resolution.height,
			frame: timelineState.currentFrame
		});
	}

	sendFileToWavefromWorker = (source: Source) => {
		if (!this.waveformWorker) return;
		this.waveformWorker.postMessage({
			command: 'load-file',
			sourceId: source.id,
			file: source.file
		});
	};

	private send(command: string, payload: object = {}, transfer: Transferable[] = []) {
		if (!this.mediaWorker) {
			console.error('Worker not initialized');
			return;
		}
		this.mediaWorker.postMessage({ command, ...payload }, transfer);
	}

	private async waveformWorkerListner(event: MessageEvent) {
		switch (event.data.command) {
			case 'waveform-complete': {
				const waveform = event.data.data;
				if (!waveform) return;
				const source = appState.sources.find((source) => source.id === event.data.sourceId);
				if (!source) return;
				source.audioWaveform = waveform;
				timelineState.invalidateWaveform = true;
			}
		}
	}

	private async mediaWorkerListner(event: MessageEvent) {
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
	}
}
