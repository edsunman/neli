import { WebGPURenderer } from './renderer';
import { Encoder } from './encoder';
import { loadFileNew } from './file';
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

const clips: WorkerClip[] = [];
const sources: WorkerVideoSource[] = [];

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
				if (e.data.type === 'video') {
					const newSource = await loadFileNew(e.data.file, e.data.id);
					if (!newSource) return;
					sources.push(newSource);
					//console.log(newSource);
					sendFrameForThumbnail(newSource);
				} else if (e.data.type === 'image') {
					const bitmap = await createImageBitmap(e.data.file);
					renderer.loadTexture(bitmap, e.data.id);
					//@ts-expect-error scope issue?
					self.postMessage({ command: 'thumbnail', sourceId: e.data.id, gap: 0, bitmap }, [bitmap]);
				}
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
				if (seeking) break;
				self.postMessage({ command: 'ready-to-play' });
				playing = true;
				seeking = false;
				startPlayLoop(e.data.frame);
			}
			break;
		case 'pause':
			{
				playing = false;
				decoderPool.pauseAll();
				latestSeekFrame = e.data.frame;
				if (seeking) break;
				processSeekFrame();
			}
			break;
		case 'seek': {
			latestSeekFrame = e.data.frame;
			if (seeking) break;
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

const sendFrameForThumbnail = async (source: WorkerVideoSource) => {
	const decoder = decoderPool.assignDecoder('thumbnail');
	if (!decoder) return;
	decoder.setup(source.videoConfig, source.videoSampleSink, source.encodedPacketSink);
	const videoFrame = await decoder?.decodeFrame(60);
	if (!videoFrame) return;
	//@ts-expect-error webworker scope
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

	await setupFrame(startingFrame);

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

const setupFrame = async (frameNumber: number) => {
	// start decoders and wait for them to flush
	for (const clip of clips) {
		if (clip.type !== 'video' || clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			const clipFrame = frameNumber - clip.start + clip.sourceOffset;
			await decoderPool.decoders.get(clip.id)?.play(clipFrame);
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
			f = decoder?.run(clipFrame * 33.33333333, encoding);
			//console.log(`requesting frame ${clipFrame}, got ${f?.timestamp}`);
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
				let decoder;
				decoder = decoderPool.decoders.get(clip.id);
				if (!decoder) decoder = setupNewDecoder(clip);
				if (decoder) {
					decoder.usedThisFrame = true;
					decoder.play(clipStartFrame);
				}
			}
		}

		decoderPool.pauseAllUnused();
	}

	renderer.startPaint();

	let i = 0;
	for (const clip of activeClips) {
		i++;
		const height = clip.params[0] * (clip.sourceWidth / 1920);
		const width = clip.params[1] * (clip.sourceHeight / 1080);

		if (clip.type === 'video') {
			const frame = videoFrames.get(clip.id);
			if (!frame) continue;
			renderer.videoPass(i, frame, clip.params, height, width);
		}
		if (clip.type === 'image') {
			renderer.imagePass(i, clip.sourceId, clip.params, height, width);
		}
		if (clip.type === 'text') {
			if (!clip.text) clip.text = '_';
			renderer.textPass(i, clip.params, clip.text);
		}
		if (clip.type === 'test') {
			renderer.testPass(i, frameNumber - clip.start, clip.params);
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
	decoder.setup(source.videoConfig, source.videoSampleSink, source.encodedPacketSink);
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
	await encoder.setup();

	const durationInFrames = endFrame - startFrame;

	encodeAudio(audioBuffer, durationInFrames);
	await encoder.finalizeAudio();

	await setupFrame(startFrame);

	try {
		for await (const { frame, index } of frameGenerator(durationInFrames, startFrame)) {
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
		/* const url = await encoder.finalize();
		self.postMessage({
			command: 'download-link',
			fileName: `${fileName}.mp4`,
			link: url
		}); */
		const file = await encoder.finalize();
		if (!file) return;
		self.postMessage({
			command: 'download-file',
			file
		});
	} catch (err) {
		encoding = false;
		console.error(err);
		self.postMessage({ command: 'encode-progress', percentComplete: -1 });
	}

	/* 	let i = 0;
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

	decodeLoop(); */
};

const encodeAudio = (audioBuffer: Float32Array, durationInFrames: number) => {
	const numberOfChannels = 2;

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

// Attempt to draw frame or throw an error after ~3 seconds (300 * 10ms)
async function drawFrameAndEnsureFrameIsReady(frameIndex: number, maxRetries = 300): Promise<void> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const success = await buildAndDrawFrame(frameIndex, true);
		if (success) return;
		console.log('retry', frameIndex);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	console.error(
		`Frame Timeout: Frame ${frameIndex} failed to render after ${maxRetries} attempts.`
	);
}
