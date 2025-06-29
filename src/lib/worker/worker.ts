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
			}
			break;
		case 'load-file':
			{
				const { chunks, config } = await loadFile(e.data.file);
				sources.push({ id: e.data.id, chunks, config });
			}
			break;
		case 'encode':
			{
				encodeAndCreateFile();
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
			if (seeking) return;
			seeking = true;

			const foundClipIndex = clips.findIndex((clip) => e.data.clip.id === clip.id);

			if (foundClipIndex > -1) {
				e.data.clip.decoder = clips[foundClipIndex].decoder;
				clips[foundClipIndex] = e.data.clip;
			} else {
				clips.push(e.data.clip);
			}

			await buildAndDrawFrame(e.data.frame);

			seeking = false;
		}
	}
});

const startPlayLoop = async (frame: number) => {
	const startingFrame = frame;

	setupFrame(startingFrame);

	let firstRAFTimestamp: number | null = null;
	let previousFrame = -1;
	let i = 0;
	const loop = async (rafTimestamp: number) => {
		if (!playing) return;

		// pause for two loops to wait for VideoDecoders to warm up
		if (i < 2) {
			i++;
			self.requestAnimationFrame(loop);
			return;
		}

		if (firstRAFTimestamp === null) {
			firstRAFTimestamp = rafTimestamp;
		}

		const elapsedTimeMs = rafTimestamp - firstRAFTimestamp;
		const targetFrame = Math.round((elapsedTimeMs / 1000) * 30) + startingFrame;

		if (targetFrame === previousFrame) {
			self.requestAnimationFrame(loop);
			return;
		}

		await buildAndDrawFrame(targetFrame, true);

		previousFrame = targetFrame;
		self.requestAnimationFrame(loop);
	};

	self.requestAnimationFrame(loop);
};

const setupFrame = (frame: number) => {
	for (const clip of clips) {
		if (clip.type !== 'video') continue;
		if (clip.start <= frame && clip.start + clip.duration > frame) {
			const clipFrame = frame - clip.start + clip.sourceOffset;
			if (!clip.decoder) {
				return;
			}
			clip.decoder.play(clipFrame);
			console.log('starting play', clipFrame);
		}
	}
};

const buildAndDrawFrame = async (frame: number, run = false) => {
	if (!renderer) return;

	const shapeClips = [];
	const videoClips = [];
	for (const clip of clips) {
		if (clip.start <= frame && clip.start + clip.duration > frame) {
			if (clip.type === 'text') {
				shapeClips.push(clip);
			} else {
				videoClips.push(clip);
			}
		}
	}

	// get frame for each video clip
	const videoFrames = [];
	for (const videoClip of videoClips) {
		const clipFrame = frame - videoClip.start + videoClip.sourceOffset;
		let f;
		if (run) {
			if (!videoClip.decoder) return;
			f = videoClip.decoder.run(clipFrame * 33.33333333);
		} else {
			if (!videoClip.decoder) {
				await setupNewDecoder(videoClip);
			}
			if (videoClip.decoder) f = await videoClip.decoder.decodeFrame(clipFrame);
		}
		if (encoding && !f) {
			// a blank frame from decoder while encoding
			// is unacceptable, so abort
			return;
		}
		videoFrames.push(f);
		if (videoClip.decoder) videoClip.decoder.lastUsedTime = performance.now();
	}

	if (run) {
		// look ahead
		for (const clip of clips) {
			if (clip.type !== 'video') continue;
			if (frame < clip.start && frame > clip.start - 4) {
				const frameDistance = clip.start - frame;
				//console.log(`clip starts in ${frameDistance} frames`)
				const clipStartFrame = frame - clip.start + clip.sourceOffset + frameDistance;
				if (!clip.decoder) {
					await setupNewDecoder(clip);
				}
				if (!clip.decoder) return;
				clip.decoder.play(clipStartFrame);
			}
		}
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
	const decoder = await decoderPool.getDecoder(source.config);
	if (!decoder) return;
	for (const c of clips) {
		if (c.id === decoder.clipId) {
			c.decoder = null;
		}
	}
	clip.decoder = decoder;
	decoder.clipId = clip.id;
	decoder.setupDecoder(source.config, source.chunks);
};

const encodeAndCreateFile = async () => {
	encoding = true;

	encoder.setup();
	setupFrame(0);

	//await new Promise((resolve) => setTimeout(resolve, 500));

	let i = 0;
	const decodeLoop = async () => {
		const success = await buildAndDrawFrame(i, true);
		if (!success) {
			setTimeout(decodeLoop, 0);
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
			self.postMessage({ name: 'download-link', link: url });
		}
	};

	decodeLoop();
};
