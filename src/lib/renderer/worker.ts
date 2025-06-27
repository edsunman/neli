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
						renderer?.draw(frame);
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

	let foundClip = null;
	for (const clip of clips) {
		if (clip.start <= frame && clip.start + clip.duration > frame) {
			foundClip = clip;
			continue;
		}
	}

	if (!foundClip) {
		await renderer.blankFrame();
		return;
	}

	const clipFrame = frame - foundClip.start + foundClip.sourceOffset;

	if (foundClip.type === 'video') {
		const f = await decoder.decodeFrame(clipFrame);
		if (f) await renderer.draw(f);
	} else {
		await renderer.drawShape(
			1,
			foundClip.scaleX,
			foundClip.scaleY,
			foundClip.positionX,
			foundClip.positionY
		);
	}
};

const encodeAndCreateFile = () => {
	encoder.setup();
	decoder.play(0);

	let i = 0;
	const decodeLoop = async () => {
		const frame = decoder.run(i * 33.33333333);

		if (frame) {
			renderer.draw(frame);
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
