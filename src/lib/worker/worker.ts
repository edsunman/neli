import { WebGPURenderer } from './renderer';
import { Encoder } from './encoder';
import { loadFile } from './file';
import { DecoderPool } from './pool';
import type { WorkerClip, WorkerSource } from '$lib/types';
//import { Audio_Decoder } from './audioDecoder';

let renderer: WebGPURenderer;
let encoder: Encoder;
let canvas: OffscreenCanvas;
let decoderPool: DecoderPool;
//let audioDecoder: Audio_Decoder;

let playing = false;
let seeking = false;
let encoding = false;

const clips: WorkerClip[] = [];
const sources: WorkerSource[] = [];

self.addEventListener('message', async function (e) {
	//console.info(`Worker message: ${JSON.stringify(e.data)}`);
	switch (e.data.command) {
		case 'init':
			{
				decoderPool = new DecoderPool();
				encoder = new Encoder();
				canvas = e.data.canvas;
				renderer = new WebGPURenderer(canvas);
				//audioDecoder = new Audio_Decoder();
			}
			break;
		case 'load-file':
			{
				const newSource = await loadFile(e.data.file);
				newSource.id = e.data.id;
				sources.push(newSource);
				console.log(newSource);
				//audioDecoder.setup(newSource.audioConfig, newSource.audioChunks);
			}
			break;
		case 'encode':
			{
				encodeAndCreateFile(e.data.audioBuffer);
			}
			break;
		case 'play':
			{
				playing = true;
				startPlayLoop(e.data.frame);
			}
			break;
		case 'pause':
			{
				playing = false;
				decoderPool.pauseAll();
				//audioDecoder.pause();
			}
			break;
		case 'seek': {
			playing = false;
			if (seeking) return;
			seeking = true;

			decoderPool.pauseAll();
			await buildAndDrawFrame(e.data.frame);

			seeking = false;
			break;
		}
		case 'clip': {
			const foundClipIndex = clips.findIndex((clip) => e.data.clip.id === clip.id);

			if (foundClipIndex > -1) {
				e.data.clip.decoder = clips[foundClipIndex].decoder;
				clips[foundClipIndex] = e.data.clip;
			} else {
				clips.push(e.data.clip);
			}
			// we may get multiple worker messages so don't
			// draw just yet
			//this.setTimeout(() => buildAndDrawFrame(e.data.frame), 0);
			if (seeking) return;
			seeking = true;
			await buildAndDrawFrame(e.data.frame);
			seeking = false;
			break;
		}
	}
});

const startPlayLoop = async (frame: number) => {
	//audioDecoder.play(frame);

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

		const elapsedTimeMs = timestamp - firstTimestamp;
		const deltaTime = timestamp - lastTime;
		lastTime = timestamp;
		accumulator += deltaTime;

		// the - 1 here is an 'epsilon' to make playback smoother
		while (accumulator >= MS_PER_FRAME - 1) {
			targetFrame = previousFrame + 1;
			accumulator -= MS_PER_FRAME;
		}

		//audioDecoder.run(elapsedTimeMs);

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

const setupFrame = (frame: number) => {
	for (const clip of clips) {
		if (clip.type !== 'video' || clip.deleted) continue;
		if (clip.start <= frame && clip.start + clip.duration > frame) {
			const clipFrame = frame - clip.start + clip.sourceOffset;
			if (!clip.decoder) {
				return;
			}
			clip.decoder.play(clipFrame);
		}
	}
};

const buildAndDrawFrame = async (frame: number, run = false) => {
	if (!renderer) return;

	const shapeClips = [];
	const videoClips = [];
	for (const clip of clips) {
		if (clip.deleted) continue;
		if (clip.start <= frame && clip.start + clip.duration > frame) {
			if (clip.type === 'text') {
				shapeClips.push(clip);
			} else {
				videoClips.push(clip);
			}
		}
	}

	decoderPool.markAllAsUnused();

	// get frame for each video clip
	const videoFrames = [];
	for (const videoClip of videoClips) {
		const clipFrame = frame - videoClip.start + videoClip.sourceOffset;
		let f;
		if (run) {
			if (!videoClip.decoder) {
				return;
			}
			f = videoClip.decoder.run(clipFrame * 33.33333333);
		} else {
			if (!videoClip.decoder) {
				await setupNewDecoder(videoClip);
			}
			if (videoClip.decoder) f = await videoClip.decoder.decodeFrame(clipFrame);
		}
		if (encoding && !f) {
			// a blank frame from a decoder while encoding
			// is unacceptable, so abort
			return;
		}
		videoFrames.push(f);
		if (videoClip.decoder) {
			videoClip.decoder.lastUsedTime = performance.now();
			videoClip.decoder.usedThisFrame = true;
		}
	}

	if (run) {
		// look ahead
		for (const clip of clips) {
			if (clip.type !== 'video' || clip.deleted) continue;
			if (frame < clip.start && frame > clip.start - 4) {
				const frameDistance = clip.start - frame;
				//console.log(`clip starts in ${frameDistance} frames`);
				const clipStartFrame = frame - clip.start + clip.sourceOffset + frameDistance;
				if (!clip.decoder) {
					await setupNewDecoder(clip);
				}
				if (!clip.decoder) return;
				clip.decoder.usedThisFrame = true;
				clip.decoder.play(clipStartFrame);
			}
		}

		decoderPool.pauseAllUnused();
	}

	renderer.startPaint();

	for (let i = 0; i < videoClips.length; i++) {
		const frame = videoFrames[i];
		if (!frame) continue;
		renderer.videoPass(
			frame,
			videoClips[i].scaleX,
			videoClips[i].scaleY,
			videoClips[i].positionX,
			videoClips[i].positionY
		);
	}

	for (let i = 0; i < shapeClips.length; i++) {
		renderer.shapePass(
			1,
			shapeClips[i].scaleX,
			shapeClips[i].scaleY,
			shapeClips[i].positionX,
			shapeClips[i].positionY
		);
	}

	await renderer.endPaint();
	return true;
};

// Gets decoder from pool and assignes to clip
const setupNewDecoder = async (clip: WorkerClip) => {
	const source = sources.find((s) => s.id === clip.sourceId);
	if (!source) return;
	const decoder = await decoderPool.getDecoder();
	if (!decoder) return;
	for (const c of clips) {
		if (c.id === decoder.clipId) {
			c.decoder = null;
		}
	}
	clip.decoder = decoder;
	decoder.clipId = clip.id;
	decoder.setup(source.videoConfig, source.videoChunks);
};

const encodeAndCreateFile = async (audioBuffer: Float32Array) => {
	encoding = true;

	encoder.setup();

	const numberOfChannels = 2;
	const totalInputFrames = 48000 * 10;

	const CHUNK_SIZE_FRAMES = 1024; // Number of frames per AudioData chunk
	//const BYTES_PER_SAMPLE = Float32Array.BYTES_PER_ELEMENT; // 4 bytes for f32

	const individualPlanarChannels = Array.from({ length: numberOfChannels }, (_, c) => {
		// Each channel's data starts at an offset equal to 'c' times the total frames per channel
		const startOffset = c * totalInputFrames;
		// Create a Float32Array VIEW of the specific channel's data within the main ArrayBuffer
		return new Float32Array(
			audioBuffer.buffer,
			startOffset * Float32Array.BYTES_PER_ELEMENT,
			totalInputFrames
		);
	});

	let encodeTimestamp = 0;
	// Loop through the individual planar channels for chunking
	// We'll chunk based on the length of the first channel
	for (let i = 0; i < totalInputFrames; i += CHUNK_SIZE_FRAMES) {
		const currentChunkFrames = Math.min(CHUNK_SIZE_FRAMES, totalInputFrames - i);

		if (currentChunkFrames <= 0) {
			continue; // Skip empty last chunk if total frames are exact multiple
		}

		// Create a combined planar buffer for the current AudioData chunk
		const combinedChunkDataForAudioData = new Float32Array(currentChunkFrames * numberOfChannels);
		let offsetInCombinedChunk = 0;

		for (let c = 0; c < numberOfChannels; c++) {
			// Get the slice of the current channel's data for this chunk
			const channelSlice = individualPlanarChannels[c].subarray(i, i + currentChunkFrames);

			// Copy this channel's slice into the combined chunk data
			if (c === 0) combinedChunkDataForAudioData.set(channelSlice, offsetInCombinedChunk);
			offsetInCombinedChunk += currentChunkFrames; // Advance offset by frames for the next channel
		}

		// Create AudioData object
		const audioFrame = new AudioData({
			format: 'f32-planar', // Or 'f32' if your data is already planar, or 's16' for Int16
			sampleRate: 48000,
			numberOfChannels: numberOfChannels,
			numberOfFrames: currentChunkFrames,
			timestamp: encodeTimestamp, // Timestamp in microseconds
			data: combinedChunkDataForAudioData.buffer // Pass the underlying ArrayBuffer
		});

		encoder.encodeAudio(audioFrame);
		encodeTimestamp += audioFrame.duration; // Advance timestamp by this frame's duration
		audioFrame.close(); // Important: Release the AudioData buffer
	}

	await encoder.finalizeAudio();

	setupFrame(0);

	let i = 0;
	let retries = 0;
	const maxRetries = 300;
	const decodeLoop = async () => {
		const success = await buildAndDrawFrame(i, true);
		if (!success) {
			retries++;
			if (retries < maxRetries) {
				setTimeout(decodeLoop, 0);
			} else {
				encoding = false;
				console.warn('encode failed');
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

		if (i < 300) {
			setTimeout(decodeLoop, 0);
		} else {
			//	decoder.pause();
			encoding = false;
			const url = await encoder.finalize();
			self.postMessage({ command: 'download-link', link: url });
		}
	};

	decodeLoop();
};
