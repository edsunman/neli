import { WebGPURenderer } from './renderer';
import { Decoder } from './decoder';
import { Encoder } from './encoder';
import type { WorkerClip } from '$lib/types';

let renderer: WebGPURenderer;
let decoder: Decoder;
let encoder: Encoder;
let canvas: OffscreenCanvas;

let playing = false;
let seeking = false;

const clips: WorkerClip[] = [];

self.addEventListener('message', async function (e) {
	//console.info(`Worker message: ${JSON.stringify(e.data)}`);

	switch (e.data.command) {
		case 'initialize':
			{
				decoder = new Decoder();
				encoder = new Encoder();
				canvas = e.data.canvas;
				renderer = new WebGPURenderer(canvas);
			}
			break;
		case 'load-file':
			{
				await decoder.loadFile(e.data.file).then((e) => console.log(e));
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
				decoder.play(e.data.frame);

				let firstRAFTimestamp: number | null = null;

				const loop = (rafTimestamp: number) => {
					if (!playing) return;

					if (firstRAFTimestamp === null) {
						firstRAFTimestamp = rafTimestamp;
					}

					const elapsedTimeMs = rafTimestamp - firstRAFTimestamp;
					const frame = decoder.run(elapsedTimeMs);

					if (frame) {
						//renderer?.draw(frame);
					}

					self.requestAnimationFrame(loop);
				};
				self.requestAnimationFrame(loop);
			}
			break;
		case 'pause':
			decoder.pause();
			playing = false;

			break;
		case 'seek': {
			if (seeking) {
				//console.log('stuck');
				return;
			}
			seeking = true;

			await buildAndDrawFrame(e.data.frame);

			seeking = false;
			break;
		}
		case 'clip': {
			if (seeking) return;
			seeking = true;

			const foundClipIndex = clips.findIndex((clip) => e.data.clip.id === clip.id);

			if (foundClipIndex > -1) {
				clips[foundClipIndex] = e.data.clip;
			} else {
				clips.push(e.data.clip);
			}

			await buildAndDrawFrame(e.data.frame);

			seeking = false;
		}
	}
});

const buildAndDrawFrame = async (frame: number) => {
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

	if (shapeClips.length < 1 && videoClips.length < 1) {
		renderer.startPaint();
		await renderer.endPaint();
		return;
	}

	const videoFrames = [];
	for (const videoClip of videoClips) {
		const clipFrame = frame - videoClip.start + videoClip.sourceOffset;
		const f = await decoder.decodeFrame(clipFrame);
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
};

const encodeAndCreateFile = () => {
	encoder.setup();
	decoder.play(0);

	let i = 0;
	const decodeLoop = async () => {
		const frame = decoder.run(i * 33.33333333);

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
			decoder.pause();
			const url = await encoder.finalize();
			self.postMessage({ name: 'download-link', link: url });
		}
	};

	decodeLoop();
};
