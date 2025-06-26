import { WebGPURenderer } from './renderer';
import { Decoder } from './decoder';
import * as Mp4Muxer from 'mp4-muxer';

let renderer: WebGPURenderer;
let decoder: Decoder;
let canvas: OffscreenCanvas;

let playing = false;

type WorkerClip = {
	id: string;
	start: number;
	duration: number;
	sourceOffset: number;
	scaleX: number;
	scaleY: number;
	positionX: number;
	positionY: number;
};

const clips: WorkerClip[] = [];

let seeking = false;

self.addEventListener('message', async function (e) {
	//console.info(`Worker message: ${JSON.stringify(e.data)}`);

	switch (e.data.command) {
		case 'initialize':
			{
				decoder = new Decoder();
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
				const muxer = new Mp4Muxer.Muxer({
					target: new Mp4Muxer.ArrayBufferTarget(),

					video: {
						// If you change this, make sure to change the VideoEncoder codec as well
						codec: 'avc',
						width: 1920,
						height: 1080
					},

					// mp4-muxer docs claim you should always use this with ArrayBufferTarget
					fastStart: 'in-memory'
				});

				const videoEncoder = new VideoEncoder({
					output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
					error: (e) => console.error(e)
				});
				//const blob = await canvas.convertToBlob({ type: 'image/png' });
				//console.log(canvas.transferToImageBitmap());
				// This codec should work in most browsers
				// See https://dmnsgn.github.io/media-codecs for list of codecs and see if your browser supports
				videoEncoder.configure({
					codec: 'avc1.420029',
					width: 1920,
					height: 1080,
					bitrate: 10_000_000,
					bitrateMode: 'constant'
				});

				decoder.play(0);

				let i = 0;
				const decodeLoop = async () => {
					//console.log('trying');
					const frame = decoder.run(i * 33.33333333);
					if (frame) {
						//console.log(frame.timestamp);
						renderer.draw(frame);

						const newFrame = new VideoFrame(canvas, {
							// Equally spaces frames out depending on frames per second
							timestamp: (i * 1e6) / 30,
							alpha: 'discard'
						});

						videoEncoder.encode(newFrame);
						newFrame.close();
						i++;
					}
					if (i < 900) {
						setTimeout(decodeLoop, 0);
					} else {
						await videoEncoder.flush();

						muxer.finalize();

						const buffer = muxer.target.buffer;
						console.log(new Blob([buffer]));
						const blob = new Blob([buffer]);
						//onst file = new File([blob], 'name');
						const url = URL.createObjectURL(blob);
						self.postMessage({ name: 'download-link', link: url });
					}
				};

				decodeLoop();
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
				return;
			}
			seeking = true;

			await decoder.decodeFrame(e.data.frame)?.then((frame) => {
				if (frame) renderer?.draw(frame);
			});

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

			await drawFrame(e.data.frame);

			seeking = false;
		}
	}
});

const drawFrame = async (frame: number) => {
	let foundClip = null;
	for (const clip of clips) {
		if (clip.start < frame && clip.start + clip.duration > frame) {
			foundClip = clip;
			continue;
		}
	}

	if (foundClip) {
		await renderer?.drawShape(
			1,
			foundClip.scaleX,
			foundClip.scaleY,
			foundClip.positionX,
			foundClip.positionY
		);
	} else {
		await renderer?.drawShape(0, 1, 1, 1, 1);
	}
};
