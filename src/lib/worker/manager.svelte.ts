import MediaWorker from './worker?worker';
import WaveformWorker from './waveformWorker?worker';
import { appState, timelineState } from '$lib/state.svelte';

import type { Source } from '$lib/source/source.svelte';
import type { Clip } from '$lib/clip/clip.svelte';
import type { WorkerClip } from '$lib/types';

export class WorkerManager {
	private mediaWorker: Worker | undefined;
	private waveformWorker: Worker | undefined;
	private pendingRequests = new Map<string, (data: unknown) => void>();

	setup(canvas: HTMLCanvasElement) {
		this.mediaWorker = new MediaWorker();
		this.waveformWorker = new WaveformWorker();
		this.mediaWorker.addEventListener('message', (e) => this.mediaWorkerListner(e));
		this.waveformWorker.addEventListener('message', (e) => this.mediaWorkerListner(e));

		const offscreenCanvas = canvas.transferControlToOffscreen();
		return this.request(
			this.mediaWorker,
			'init',
			{
				command: 'init',
				canvas: offscreenCanvas
			},
			[offscreenCanvas]
		);
	}

	reset() {
		this.send('reset');
	}

	async sendFile(source: Source) {
		if (!this.mediaWorker) throw new Error('Worker not available');
		type ReturnData = {
			videoFrame?: VideoFrame;
			bitmap?: ImageBitmap;
			sourceId: string;
		};
		return this.request<ReturnData>(this.mediaWorker, 'load-file', {
			id: source.id,
			file: source.file,
			type: source.type
		});
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
				deleted: clip.deleted,
				keyframeTracks: clip.keyframeTracks
			};
		});

		this.send('clip', { frame: timelineState.currentFrame, clips: workerClips });
	}

	seek(frame: number) {
		this.send('seek', { frame });
	}

	async play(frame: number) {
		if (!this.mediaWorker) throw new Error('Worker not available');
		type ReturnData = {
			workerStarted: boolean;
		};
		return this.request<ReturnData>(this.mediaWorker, 'play', { frame });
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

	getThumbnail() {
		if (!this.mediaWorker) throw new Error('Worker not available');
		type ReturnData = {
			bitmap: ImageBitmap;
		};
		return this.request<ReturnData>(this.mediaWorker, 'project-thumbnail');
	}

	sendFileToWaveformWorker = async (source: Source) => {
		if (!this.waveformWorker) throw new Error('Worker not available');
		type ReturnData = {
			requestId: string;
			waveform: Float32Array;
		};
		return this.request<ReturnData>(this.waveformWorker, 'load-file', {
			file: source.file
		});
	};

	private async request<T>(
		worker: Worker,
		command: string,
		payload: object = {},
		transfer: Transferable[] = []
	) {
		const requestId = crypto.randomUUID();
		return new Promise<T>((resolve) => {
			this.pendingRequests.set(requestId, ((response: T) => resolve(response)) as (
				data: unknown
			) => void);
			worker.postMessage({ command, requestId, ...payload }, transfer);
		});
	}

	private send(command: string, payload: object = {}, transfer: Transferable[] = []) {
		if (!this.mediaWorker) throw new Error('Worker not available');
		this.mediaWorker.postMessage({ command, ...payload }, transfer);
	}

	private async mediaWorkerListner(event: MessageEvent) {
		const { command, requestId } = event.data;

		// Is this a response to a pending async request
		if (requestId && this.pendingRequests.has(requestId)) {
			const resolve = this.pendingRequests.get(requestId);
			resolve?.(event.data);
			this.pendingRequests.delete(requestId);
			return;
		}

		switch (command) {
			case 'encode-progress': {
				if (event.data.percentComplete > -1) {
					appState.progress.percentage = event.data.percentComplete;
					if (event.data.percentComplete === 100) appState.exportSuccessCallback(true);
				} else {
					appState.exportSuccessCallback(false);
					appState.progress.percentage = 0;
					appState.progress.message = 'encoding failed';
					appState.progress.fail = true;
				}

				break;
			}
			case 'download-file': {
				const url = URL.createObjectURL(event.data.file);
				const a = document.createElement('a');
				a.href = url;
				a.download = event.data.fileName;
				a.style.display = 'none';

				document.body.appendChild(a);
				a.click();

				document.body.removeChild(a);
				URL.revokeObjectURL(event.data.link);

				appState.progress.message = 'done';
				appState.progress.percentage = 100;

				break;
			}
		}
	}
}
