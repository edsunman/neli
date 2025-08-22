import { WebGPURenderer } from './renderer';
import { Encoder } from './encoder';
import { loadFile } from './file';
import { DecoderPool } from './pool';
import type { WorkerClip, WorkerSource } from '$lib/types';

let renderer: WebGPURenderer;
let encoder: Encoder;
let canvas: OffscreenCanvas;
let decoderPool: DecoderPool;

let playing = false;
let seeking = false;
let encoding = false;
let latestSeekFrame = 0;

const clips: WorkerClip[] = [];
const sources: WorkerSource[] = [];

self.addEventListener('message', async function (e) {
	switch (e.data.command) {
		case 'init':
			{
				decoderPool = new DecoderPool();
				encoder = new Encoder();
				canvas = e.data.canvas;
				renderer = new WebGPURenderer(canvas);
			}
			break;
		case 'load-file':
			{
				const newSource = await loadFile(e.data.file, e.data.id);
				if (!newSource) return;
				sources.push(newSource);
				sendFrameForThumbnail(newSource);
			}
			break;
		case 'encode':
			{
				encodeAndCreateFile(
					e.data.audioBuffer,
					e.data.fileName,
					e.data.startFrame,
					e.data.endFrame
				);
			}
			break;
		case 'play':
			{
				playing = true;
				seeking = false;
				startPlayLoop(e.data.frame);
			}
			break;
		case 'pause':
			{
				playing = false;
				decoderPool.pauseAll();
			}
			break;
		case 'seek': {
			latestSeekFrame = e.data.frame;
			if (seeking) {
				break;
			}
			processSeekFrame();
			break;
		}
		case 'clip': {
			//console.log(e.data.clip);
			const foundClipIndex = clips.findIndex((clip) => e.data.clip.id === clip.id);

			if (foundClipIndex > -1) {
				clips[foundClipIndex] = e.data.clip;
			} else {
				clips.push(e.data.clip);
			}

			if (seeking) return;
			seeking = true;
			await buildAndDrawFrame(e.data.frame);
			seeking = false;
			break;
		}
	}
});

const sendFrameForThumbnail = async (source: WorkerSource) => {
	const decoder = decoderPool.assignDecoder('thumbnail');
	if (!decoder) return;
	decoder.setup(source.videoConfig, source.videoChunks);
	const videoFrame = await decoder?.decodeFrame(60);
	if (!videoFrame) return;
	//@ts-expect-error scope issue?
	self.postMessage({ command: 'thumbnail', sourceId: source.id, gap: source.gap, videoFrame }, [
		videoFrame
	]);
};

const processSeekFrame = async () => {
	seeking = true;

	while (true) {
		const frameToProcess = latestSeekFrame;

		decoderPool.pauseAll();
		await buildAndDrawFrame(frameToProcess);

		if (latestSeekFrame === frameToProcess) {
			break;
		}
	}

	seeking = false;
};

const startPlayLoop = async (frame: number) => {
	const startingFrame = frame;

	setupFrame(startingFrame);

	let firstTimestamp: number | null = null;
	let previousFrame = -1;

	const MS_PER_FRAME = 1000 / 30; // For 30 FPS
	let accumulator = 0;
	let lastTime = 0;
	let targetFrame = startingFrame;

	let i = 0;
	const loop = async (timestamp: number) => {
		if (!playing) return;

		// pause for two loops to wait for VideoDecoders to warm up
		if (i < 2) {
			i++;
			self.requestAnimationFrame(loop);
			return;
		}

		if (lastTime === 0) {
			lastTime = timestamp;
		}

		if (firstTimestamp === null) {
			firstTimestamp = timestamp;
		}

		const deltaTime = timestamp - lastTime;
		lastTime = timestamp;
		accumulator += deltaTime;

		// the - 1 here is an 'epsilon' to make playback smoother
		while (accumulator >= MS_PER_FRAME - 1) {
			targetFrame = previousFrame + 1;
			accumulator -= MS_PER_FRAME;
		}

		if (targetFrame === previousFrame) {
			self.requestAnimationFrame(loop);
			return;
		}

		buildAndDrawFrame(targetFrame, true);

		previousFrame = targetFrame;
		self.requestAnimationFrame(loop);
	};

	self.requestAnimationFrame(loop);
};

const setupFrame = (frameNumber: number) => {
	for (const clip of clips) {
		if (clip.type !== 'video' || clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			const clipFrame = frameNumber - clip.start + clip.sourceOffset;
			decoderPool.decoders.get(clip.id)?.play(clipFrame);
		}
	}
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

	// get frame for each video clip
	const videoFrames = new Map();
	for (const videoClip of activeClips) {
		if (videoClip.type !== 'video') continue;
		let decoder = decoderPool.decoders.get(videoClip.id);
		const clipFrame = frameNumber - videoClip.start + videoClip.sourceOffset;
		let f;
		if (run) {
			f = decoder?.run(clipFrame * 33.33333333);
		} else {
			if (!decoder) {
				decoder = setupNewDecoder(videoClip);
			}
			f = await decoder?.decodeFrame(clipFrame);
		}
		if (encoding && !f) {
			// a blank frame from a decoder while encoding, so abort
			return;
		}
		videoFrames.set(videoClip.id, f);
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
				const decoder = decoderPool.decoders.get(clip.id);
				if (!decoder) {
					setupNewDecoder(clip);
				}
				if (!decoder) return;
				decoder.usedThisFrame = true;
				decoder.play(clipStartFrame);
			}
		}

		decoderPool.pauseAllUnused();
	}

	renderer.startPaint();

	for (const clip of activeClips) {
		if (clip.type === 'video') {
			const frame = videoFrames.get(clip.id);
			if (!frame) continue;
			const height = clip.params[0] * (clip.sourceWidth / 1920);
			const width = clip.params[1] * (clip.sourceHeight / 1080);
			renderer.videoPass(frame, clip.params, height, width);
		}
		if (clip.type === 'text') {
			if (!clip.text) clip.text = '_';
			renderer.textPass(frameNumber, clip.params, clip.text);
		}
		if (clip.type === 'test') {
			renderer.testPass(frameNumber - clip.start, clip.params);
		}
	}

	await renderer.endPaint(encoding);
	return true;
};

// Gets decoder from pool and assignes to clip
const setupNewDecoder = (clip: WorkerClip) => {
	const source = sources.find((s) => s.id === clip.sourceId);
	if (!source) return;
	const decoder = decoderPool.assignDecoder(clip.id);
	if (!decoder) return;
	decoder.setup(source.videoConfig, source.videoChunks);
	return decoder;
};

const encodeAndCreateFile = async (
	audioBuffer: Float32Array,
	fileName: string,
	startFrame: number,
	endFrame: number
) => {
	encoding = true;

	await decoderPool.pauseAll();

	encoder.setup();

	console.log(`starting at ${startFrame}`);

	const numberOfChannels = 2;
	const durationInFrames = endFrame - startFrame;
	const durationInSeconds = durationInFrames / 30;
	const totalInputFrames = 48000 * durationInSeconds;

	const chunkFrameSize = 1024; // Number of frames per AudioData chunk

	// Split buffer into seperate arrays for each channel
	const individualPlanarChannels = Array.from({ length: numberOfChannels }, (_, c) => {
		const startOffset = c * totalInputFrames;
		return new Float32Array(
			audioBuffer.buffer,
			startOffset * Float32Array.BYTES_PER_ELEMENT,
			totalInputFrames
		);
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
		audioFrame.close();
	}

	await encoder.finalizeAudio();

	setupFrame(startFrame);

	let i = 0;
	let retries = 0;
	const maxRetries = 300;
	let percentComplete = 0;
	let lastPercent = 0;
	const decodeLoop = async () => {
		const success = await buildAndDrawFrame(i + startFrame, true);
		if (!success) {
			retries++;
			if (retries < maxRetries) {
				//console.log(retries);
				setTimeout(decodeLoop, 0);
			} else {
				encoding = false;
				console.warn('encode failed');
				self.postMessage({ command: 'encode-progress', percentComplete: -1 });
			}
			return;
		}
		if (!renderer.bitmap) return;

		const newFrame = new VideoFrame(renderer.bitmap, {
			timestamp: (i * 1e6) / 30,
			alpha: 'discard'
		});

		renderer.bitmap.close();

		encoder.encode(newFrame);
		newFrame.close();
		i++;

		percentComplete = Math.floor((i / durationInFrames) * 100);

		if (percentComplete > lastPercent) {
			lastPercent = percentComplete;
			self.postMessage({ command: 'encode-progress', percentComplete });
		}

		if (i < durationInFrames) {
			setTimeout(decodeLoop, 0);
		} else {
			await decoderPool.pauseAll();
			encoding = false;
			const url = await encoder.finalize();
			self.postMessage({ command: 'download-link', fileName: `${fileName}.mp4`, link: url });
		}
	};

	decodeLoop();
};
