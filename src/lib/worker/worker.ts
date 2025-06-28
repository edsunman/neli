import { WebGPURenderer } from './renderer';
import { Decoder } from './decoder';
import { Encoder } from './encoder';
import type { WorkerClip, WorkerSource } from '$lib/types';
import { loadFile } from './file';
import { DecoderPool } from './pool';

let renderer: WebGPURenderer;
//let decoder: Decoder;
let encoder: Encoder;
let canvas: OffscreenCanvas;
let decoderPool: DecoderPool;

let playing = false;
let seeking = false;

const clips: WorkerClip[] = [];
const sources: WorkerSource[] = [];

self.addEventListener('message', async function (e) {
	//console.info(`Worker message: ${JSON.stringify(e.data)}`);

	switch (e.data.command) {
		case 'initialize':
			{
				decoderPool = new DecoderPool();
				//decoder = new Decoder();
				encoder = new Encoder();
				canvas = e.data.canvas;
				renderer = new WebGPURenderer(canvas);
			}
			break;
		case 'load-file':
			{
				const { chunks, config } = await loadFile(e.data.file);
				sources.push({ id: e.data.id, chunks, config });
				console.log(sources);
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

				let firstRAFTimestamp: number | null = null;
				let previousFrame = -1;

				const loop = async (rafTimestamp: number) => {
					if (!playing) return;

					if (firstRAFTimestamp === null) {
						firstRAFTimestamp = rafTimestamp;
					}

					const elapsedTimeMs = rafTimestamp - firstRAFTimestamp;
					const targetFrame = Math.round((elapsedTimeMs / 1000) * 30) + e.data.frame;

					if (targetFrame === previousFrame) {
						self.requestAnimationFrame(loop);
						return;
					}

					await buildAndDrawFrame(targetFrame, true);

					previousFrame = targetFrame;
					self.requestAnimationFrame(loop);
				};
				setupFrame(e.data.frame);
				self.requestAnimationFrame(loop);
			}
			break;
		case 'pause':
			//decoder.pause();
			decoderPool.pauseAll();
			playing = false;

			break;
		case 'seek': {
			playing = false;
			if (seeking) {
				//console.log('stuck');
				return;
			}
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

const setupFrame = (frame: number) => {
	for (const clip of clips) {
		if (clip.type !== 'video') continue;
		if (clip.start <= frame && clip.start + clip.duration > frame) {
			const clipFrame = frame - clip.start + clip.sourceOffset;
			if (!clip.decoder) {
				console.log('No decoder assigned to clip');
				return;
			}
			clip.decoder.play(clipFrame);
			console.log('play in setup', clipFrame);
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
			//console.log(clipFrame * 33.33333333, f?.timestamp);
		} else {
			if (!videoClip.decoder) {
				console.log('no decoder so assign');
				await setupNewDecoder(videoClip);
			}
			console.log(videoClip.decoder);
			if (videoClip.decoder) f = await videoClip.decoder.decodeFrame(clipFrame);
		}
		videoFrames.push(f);
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

	if (run) {
		// look ahead
		for (const clip of clips) {
			if (clip.type !== 'video') continue;
			// does clip start in next two frames?
			if (clip.start > frame && clip.start < frame + 2) {
				if (!videoClips.find((f) => f.id === clip.id) && run) {
					// we didnt render the video clip this frame, so start it running
					const clipFrame = frame + 1 - clip.start + clip.sourceOffset;
					if (!clip.decoder) {
						console.log('no decoder so assign');
						await setupNewDecoder(clip);
					}
					if (!clip.decoder) return;
					console.log(
						`clip id ${clip.id} about to start. It has a decoder: ${clip.decoder.clipId}`
					);
					clip.decoder.play(clipFrame);
					console.log('play', clipFrame);
				}
			}
		}
	}
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
	console.log(`clip id ${clip.id}. Decoder: ${decoder.clipId}`);
};

const encodeAndCreateFile = () => {
	encoder.setup();
	//	decoder.play(0);

	let i = 0;
	const decodeLoop = async () => {
		//	const frame = decoder.run(i * 33.33333333);

		if (frame) {
			//renderer.draw(frame);
			const newFrame = new VideoFrame(canvas, {
				timestamp: (i * 1e6) / 30,
				alpha: 'discard'
			});

			encoder.encode(newFrame);
			newFrame.close();
			i++;
		}
		if (i < 900) {
			setTimeout(decodeLoop, 0);
		} else {
			//	decoder.pause();
			const url = await encoder.finalize();
			self.postMessage({ name: 'download-link', link: url });
		}
	};

	decodeLoop();
};
