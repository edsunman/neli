import { WebGPURenderer } from './renderer';
import { Encoder } from './encoder';
import { loadFile } from './file';
import { DecoderPool } from './pool';
import type { WorkerClip, WorkerVideoSource } from '$lib/types';

let renderer: WebGPURenderer;
let encoder: Encoder;
let canvas: OffscreenCanvas;
let decoderPool: DecoderPool;

let playing = false;
let seeking = false;
let encoding = false;
let latestSeekFrame = 0;
let latestRequestId = 0;
let cancelEncode = false;
let selectedSource: WorkerVideoSource | null = null;
let programTimelineActive = false;

const clips: WorkerClip[] = [];
const sources: WorkerVideoSource[] = [];

self.addEventListener('message', async function (event) {
	switch (event.data.command) {
		case 'init': {
			decoderPool = new DecoderPool();
			encoder = new Encoder();
			canvas = event.data.canvas;
			renderer = new WebGPURenderer(canvas);
			await renderer.start();
			requestSeek();
			self.postMessage({ command: 'init-done', requestId: event.data.requestId });
			break;
		}
		case 'reset': {
			clips.length = 0;
			sources.length = 0;
			selectedSource = null;
			programTimelineActive = false;
			latestSeekFrame = 0;
			requestSeek();
			break;
		}
		case 'load-file': {
			if (event.data.type === 'video') {
				const newSource = await loadFile(event.data.file, event.data.id);
				if (!newSource) return;
				sources.push(newSource);
				sendFrameForThumbnail(newSource, event.data.requestId);
			} else if (event.data.type === 'image') {
				const bitmap = await createImageBitmap(event.data.file);
				renderer.loadTexture(bitmap, event.data.id);
				await saveFileToOPFS(event.data.file, event.data.id);
				self.postMessage(
					{
						command: 'thumbnail',
						requestId: event.data.requestId,
						sourceId: event.data.id,
						gap: 0,
						bitmap
					},
					[bitmap]
				);
			}
			break;
		}
		case 'encode': {
			encodeAndCreateFile(
				event.data.audioBuffer,
				event.data.fileName,
				event.data.startFrame,
				event.data.endFrame
			);
			break;
		}
		case 'cancelEncode': {
			cancelEncode = true;
			break;
		}
		case 'play': {
			if (seeking) {
				self.postMessage({
					command: 'ready-to-play',
					requestId: event.data.requestId,
					workerStarted: false
				});
				break;
			}
			self.postMessage({
				command: 'ready-to-play',
				requestId: event.data.requestId,
				workerStarted: true
			});
			playing = true;
			startPlayLoop(event.data.frame);
			break;
		}
		case 'pause': {
			playing = false;
			decoderPool.pauseAll();
			requestSeek(event.data.frame);
			break;
		}
		case 'seek': {
			requestSeek(event.data.frame);
			break;
		}
		case 'clip': {
			for (const clip of event.data.clips) {
				const foundClipIndex = clips.findIndex((c) => clip.id === c.id);
				if (foundClipIndex > -1) {
					clips[foundClipIndex] = clip;
				} else {
					clips.push(clip);
				}
			}
			if (!programTimelineActive) {
				requestSeek();
			}
			break;
		}
		case 'resizeCanvas': {
			renderer.resizeCanvas(event.data.width, event.data.height);
			requestSeek();
			break;
		}
		case 'showSource': {
			programTimelineActive = true;
			if (event.data.image) {
				if (seeking) break;
				seeking = true;
				const params = [1, 1, 0, 0];
				renderer.resizeCanvas(event.data.imageWidth, event.data.imageHeight);
				renderer.startPaint();
				renderer.imagePass(
					1,
					event.data.sourceId,
					params,
					event.data.imageHeight,
					event.data.imageWidth
				);
				await renderer.endPaint(encoding);
				seeking = false;
			} else {
				const source = sources.find((source) => source.id === event.data.sourceId);
				if (!source) break;
				selectedSource = source;
				renderer.resizeCanvas(source.width, source.height);
				requestSeek(event.data.frame);
				/* if (seeking) break;
				seeking = true;
				await drawSourceFrame(event.data.frame, false, selectedSource);
				seeking = false; */
			}
			break;
		}
		case 'showTimeline': {
			programTimelineActive = false;
			selectedSource = null;
			renderer.resizeCanvas(event.data.width, event.data.height);
			requestSeek(event.data.frame);
			break;
		}
		case 'showAudioSource': {
			programTimelineActive = true;
			if (seeking) break;
			seeking = true;
			renderer.resizeCanvas(1920, 1080);
			renderer.startPaint();
			renderer.audioSourcePass();
			await renderer.endPaint(encoding);
			seeking = false;
			break;
		}
		case 'project-thumbnail': {
			sendBitmapForThumbnail(event.data.requestId);
		}
	}
});

const sendFrameForThumbnail = async (source: WorkerVideoSource, requestId: string) => {
	const decoder = decoderPool.assignDecoder('thumbnail');
	if (!decoder) return;
	decoder.setup(source.videoConfig, source.encodedPacketSink);

	const videoFrame = await decoder?.decodeFrame(60);
	if (!videoFrame) return;
	self.postMessage(
		{ command: 'import-done', requestId, sourceId: source.id, gap: source.gap, videoFrame },
		[videoFrame]
	);
};

const sendBitmapForThumbnail = async (requestId: string) => {
	encoding = true;
	await buildAndDrawFrame(latestSeekFrame);
	encoding = false;
	if (!renderer || !renderer.bitmap) return;
	const bitmap = await createImageBitmap(renderer.bitmap);
	self.postMessage({ command: 'project-thumbnail', requestId, bitmap }, [bitmap]);
};

const requestSeek = (frame: number = latestSeekFrame) => {
	latestSeekFrame = frame;
	latestRequestId++;

	if (!seeking) {
		processSeekFrame();
	}
};

const processSeekFrame = async () => {
	seeking = true;
	while (true) {
		const versionToProcess = latestRequestId;
		decoderPool.pauseAll();

		if (selectedSource) {
			await drawSourceFrame(latestSeekFrame, false, selectedSource);
		} else {
			await buildAndDrawFrame(latestSeekFrame);
		}
		if (latestRequestId === versionToProcess) {
			break;
		}
	}
	seeking = false;
};

const setupFrame = async (frameNumber: number, useSavedFrame: boolean) => {
	for (const clip of clips) {
		if (clip.type !== 'video' || clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			const source = sources.find((source) => source.id === clip.sourceId);
			if (!source) return;
			const clipFrame = frameNumber - clip.start + clip.sourceOffset;
			const frameDurationMs = 1000 / 30;
			const frameTimeMs = clipFrame * frameDurationMs;
			decoderPool.decoders.get(clip.id)?.play(frameTimeMs, useSavedFrame);
		}
	}
};

const setupSourceFrame = async (frameNumber: number, source: WorkerVideoSource) => {
	const frameDurationMs = 1000 / source.frameRate;
	const frameTimeMs = frameNumber * frameDurationMs;
	decoderPool.decoders.get(source.id)?.play(frameTimeMs, true);
};

const startPlayLoop = async (startingFrame: number) => {
	let fps = 30;

	if (selectedSource) {
		fps = selectedSource.frameRate;
		await setupSourceFrame(startingFrame, selectedSource);
	} else {
		await setupFrame(startingFrame, true);
	}

	const msPerFrame = 1000 / fps;
	const epsilon = 1; // Tolerance for smoother playback
	let lastTime = 0;
	let accumulator = 0;
	let currentFrame = startingFrame;
	let warmUpCycles = 0;

	const loop = (timestamp: number) => {
		if (!playing) return;

		// Wait for decoders
		if (warmUpCycles < 2) {
			warmUpCycles++;
			return self.requestAnimationFrame(loop);
		}

		if (lastTime === 0) lastTime = timestamp;

		const deltaTime = timestamp - lastTime;
		lastTime = timestamp;
		accumulator += deltaTime;

		let frameChanged = false;
		while (accumulator >= msPerFrame - epsilon) {
			currentFrame++;
			accumulator -= msPerFrame;
			frameChanged = true;
		}

		if (frameChanged) {
			if (selectedSource) {
				drawSourceFrame(currentFrame, true, selectedSource);
			} else {
				buildAndDrawFrame(currentFrame, true);
			}
		}

		self.requestAnimationFrame(loop);
	};
	self.requestAnimationFrame(loop);
};

const drawSourceFrame = async (frameNumber: number, run = false, source: WorkerVideoSource) => {
	if (!renderer) return;

	let decoder = decoderPool.decoders.get(source.id);
	let frame;
	if (run) {
		const frameDurationMs = 1000 / source.frameRate;
		const frameTimeMs = frameNumber * frameDurationMs;
		frame = decoder?.run(frameTimeMs, encoding);
	} else {
		if (!decoder) {
			decoder = decoderPool.assignDecoder(source.id);
			if (!decoder) return;
			decoder.setup(source.videoConfig, source.encodedPacketSink);
		}
		frame = await decoder?.decodeFrame(frameNumber, source.frameRate);
	}

	if (!frame) return;

	const params = new Array(22).fill(0);
	params[0] = 1;
	params[1] = 1;
	params[18] = 1;
	params[20] = 1;
	params[21] = 1;
	renderer.startPaint();
	renderer.videoPass(1, frame, params, source.height, source.width);
	await renderer.endPaint(encoding);
	return true;
};

const buildAndDrawFrame = async (frameNumber: number, run = false) => {
	if (!renderer) return;

	const activeClips = [];
	for (const clip of clips) {
		if (clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			activeClips.push(clip);
		}
	}
	activeClips.sort((a, b) => {
		return b.track - a.track;
	});

	decoderPool.markAllAsUnused();

	// Get frame for each video clip
	const videoFrames = new Map();
	for (const videoClip of activeClips) {
		if (videoClip.type !== 'video') continue;
		let decoder = decoderPool.decoders.get(videoClip.id);
		const clipFrame = frameNumber - videoClip.start + videoClip.sourceOffset;
		let frame;
		if (run) {
			// timeline frame rate
			frame = decoder?.run(clipFrame * 33.33333333, encoding);
		} else {
			if (!decoder) {
				decoder = setupNewDecoder(videoClip);
			}
			frame = await decoder?.decodeFrame(clipFrame);
		}
		if (encoding && !frame) {
			// A blank frame from a decoder while encoding, so abort
			return;
		}
		videoFrames.set(videoClip.id, frame);
		if (decoder) {
			decoder.lastUsedTime = performance.now();
			decoder.usedThisFrame = true;
		}
	}

	if (run) {
		// look ahead
		for (const clip of clips) {
			if (clip.type !== 'video' || clip.deleted) continue;
			if (frameNumber < clip.start && frameNumber > clip.start - 4) {
				const frameDistance = clip.start - frameNumber;
				const clipStartFrame = frameNumber - clip.start + clip.sourceOffset + frameDistance;
				let decoder;
				decoder = decoderPool.decoders.get(clip.id);
				if (!decoder) decoder = setupNewDecoder(clip);
				if (decoder) {
					decoder.usedThisFrame = true;
					// timeline frame rate
					decoder.play(clipStartFrame * 33.33333333);
				}
			}
		}

		decoderPool.pauseAllUnused();
	}

	renderer.startPaint();

	for (const clip of activeClips) {
		calculateKeyframes(clip, frameNumber);
		if (clip.type === 'video') {
			const frame = videoFrames.get(clip.id);
			if (!frame) continue;
			renderer.videoPass(clip.track, frame, clip.params, clip.sourceHeight, clip.sourceWidth);
		}
		if (clip.type === 'image') {
			renderer.imagePass(
				clip.track,
				clip.sourceId,
				clip.params,
				clip.sourceHeight,
				clip.sourceWidth
			);
		}
		if (clip.type === 'text') {
			if (!clip.text) clip.text = '_';
			renderer.textPass(clip.track, clip.params, clip.text);
		}
		if (clip.type === 'test') {
			renderer.testPass(clip.track, frameNumber - clip.start, clip.params);
		}
	}

	await renderer.endPaint(encoding);
	return true;
};

const calculateKeyframes = (clip: WorkerClip, frameNumber: number) => {
	const clipFrame = frameNumber - clip.start;
	for (const [param, track] of clip.keyframeTracks) {
		const keyframes = track.keyframes;
		if (!keyframes || keyframes.length === 0) continue;

		const count = keyframes.length;
		if (clipFrame <= keyframes[0].frame) {
			clip.params[param] = keyframes[0].value;
			continue;
		}
		if (clipFrame >= keyframes[count - 1].frame) {
			clip.params[param] = keyframes[count - 1].value;
			continue;
		}

		let i = 1;
		for (; i < count; i++) {
			if (keyframes[i].frame > clipFrame) break;
		}

		const k0 = keyframes[i - 1];
		const k1 = keyframes[i];
		if (k0.easeOut === 0) {
			clip.params[param] = k0.value;
			continue;
		}

		const t = (clipFrame - k0.frame) / (k1.frame - k0.frame);
		let alpha;
		const outEase = k0.easeOut === 2;
		const inEase = k1.easeIn === 2;

		if (!outEase && !inEase) {
			alpha = t;
		} else {
			const intensity = 3.5; 
			if (outEase && inEase) {
				const tn = Math.pow(t, intensity);
				alpha = tn / (tn + Math.pow(1 - t, intensity));
			} else if (outEase) {
				alpha = Math.pow(t, intensity);
			} else if (inEase) {
				alpha = 1 - Math.pow(1 - t, intensity);
			}
		}

		clip.params[param] = k0.value + (k1.value - k0.value) * (alpha || 0);
	}
};

// Gets decoder from pool and assignes to clip
const setupNewDecoder = (clip: WorkerClip) => {
	const source = sources.find((s) => s.id === clip.sourceId);
	if (!source) return;
	const decoder = decoderPool.assignDecoder(clip.id);
	if (!decoder) return;
	decoder.setup(source.videoConfig, source.encodedPacketSink);
	return decoder;
};

const encodeAndCreateFile = async (
	audioBuffer: Float32Array,
	fileName: string,
	startFrame: number,
	endFrame: number
) => {
	encoding = true;
	cancelEncode = false;
	await decoderPool.pauseAll();
	await encoder.setup();

	const durationInFrames = endFrame - startFrame;

	encodeAudio(audioBuffer, durationInFrames);

	await setupFrame(startFrame, false);

	try {
		for await (const { frame, index } of frameGenerator(durationInFrames, startFrame)) {
			if (cancelEncode) {
				frame.close();
				break;
			}
			await encoder.encode(frame);
			frame.close();

			if (index % 30 === 0 || index === durationInFrames - 1) {
				const percentComplete = Math.floor(((index + 1) / durationInFrames) * 100);
				self.postMessage({ command: 'encode-progress', percentComplete });
			}
		}

		// Finalisation
		await decoderPool.pauseAll();
		encoding = false;

		if (cancelEncode) {
			await encoder.cancel();
			return;
		}

		const file = await encoder.finalize();
		if (!file) return;

		self.postMessage({
			command: 'download-file',
			fileName,
			file
		});
	} catch (err) {
		encoding = false;
		await encoder.cancel();
		console.error(err);
		self.postMessage({ command: 'encode-progress', percentComplete: -1 });
	}
};

const encodeAudio = (audioBuffer: Float32Array, durationInFrames: number) => {
	const numberOfChannels = 2;

	const durationInSeconds = durationInFrames / 30;
	const totalInputFrames = Math.floor(48000 * durationInSeconds);

	const chunkFrameSize = 1024; // Number of frames per AudioData chunk

	// Split buffer into seperate arrays for each channel
	const individualPlanarChannels = Array.from({ length: numberOfChannels }, (_, c) => {
		const startOffset = c * totalInputFrames;
		const startByteOffest = startOffset * Float32Array.BYTES_PER_ELEMENT;
		return new Float32Array(audioBuffer.buffer, startByteOffest, totalInputFrames);
	});

	let encodeTimestamp = 0;

	// Loop through planer channels, extract for AudioData, then send to encoder
	for (let i = 0; i < totalInputFrames; i += chunkFrameSize) {
		const currentChunkFrames = Math.min(chunkFrameSize, totalInputFrames - i);
		if (currentChunkFrames <= 0) {
			continue; // Skip empty last chunk if total frames are exact multiple
		}

		// Create a combined planar buffer for the current AudioData chunk
		const combinedChunk = new Float32Array(currentChunkFrames * numberOfChannels);
		let offsetInCombinedChunk = 0;

		for (let c = 0; c < numberOfChannels; c++) {
			const channelSlice = individualPlanarChannels[c].subarray(i, i + currentChunkFrames);
			combinedChunk.set(channelSlice, offsetInCombinedChunk);
			offsetInCombinedChunk += currentChunkFrames;
		}

		const audioFrame = new AudioData({
			format: 'f32-planar',
			sampleRate: 48000,
			numberOfChannels: numberOfChannels,
			numberOfFrames: currentChunkFrames,
			timestamp: encodeTimestamp,
			data: combinedChunk.buffer
		});

		encoder.encodeAudio(audioFrame);
		encodeTimestamp += audioFrame.duration;
	}
};

async function* frameGenerator(totalFrames: number, startFrame: number) {
	for (let i = 0; i < totalFrames; i++) {
		await drawFrameAndEnsureFrameIsReady(i + startFrame);

		if (!renderer.bitmap) {
			throw new Error('Renderer bitmap is missing.');
		}

		const frame = new VideoFrame(renderer.bitmap, {
			timestamp: (i * 1e6) / 30,
			alpha: 'discard'
		});
		renderer.bitmap.close();
		yield { frame, index: i };
	}
}

// Attempt to draw frame or throw an error after about 3 seconds (300 * 10ms)
async function drawFrameAndEnsureFrameIsReady(frameIndex: number, maxRetries = 300): Promise<void> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const success = await buildAndDrawFrame(frameIndex, true);
		if (success) return;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error(
		`Frame Timeout: Frame ${frameIndex} failed to render after ${maxRetries} attempts.`
	);
}

const saveFileToOPFS = async (file: File, fileName: string) => {
	const root = await navigator.storage.getDirectory();
	const originalExt = file.name.split('.').pop() || '';
	const finalFileName = `${fileName}.${originalExt}`;

	const existingHandle = await root
		.getFileHandle(finalFileName, { create: false })
		.catch(() => null);
	if (existingHandle) return;

	const fileHandle = await root.getFileHandle(finalFileName, { create: true });
	const accessHandle = await fileHandle.createSyncAccessHandle();

	try {
		const buffer = await file.arrayBuffer();
		accessHandle.write(new Uint8Array(buffer));
		accessHandle.flush();
	} catch (err) {
		console.error('Failed to save to OPFS:', err);
	} finally {
		accessHandle.close();
	}
};
