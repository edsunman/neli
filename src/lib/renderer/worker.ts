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
					bitrate: 500_000,
					bitrateMode: 'constant'
				});

				/* 				const newCanvas = new OffscreenCanvas(1920, 1080);
				const ctx = newCanvas.getContext('2d', {
					// This forces the use of a software (instead of hardware accelerated) 2D canvas
					// This isn't necessary, but produces quicker results
					willReadFrequently: true,
					// Desynchronizes the canvas paint cycle from the event loop
					// Should be less necessary with OffscreenCanvas, but with a real canvas you will want this
					desynchronized: true
				});

				if (!ctx) return;

				ctx.fillStyle = 'white';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				ctx.fillStyle = 'red';
				ctx.fillRect(0, 0, 200, 100);

				ctx.drawImage(canvas, 0, 0); */

				/* const adapter = await navigator.gpu.requestAdapter();
				if (!adapter) return;
				const device = await adapter.requestDevice();
	
				const context = canvas.getContext('webgpu');
				if (!context) return;
				const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
				context.configure({
					device: device,
					format: canvasFormat
				});
				const encoder = device.createCommandEncoder();
				const pass = encoder.beginRenderPass({
					colorAttachments: [
						{
							view: context.getCurrentTexture().createView(),
							loadOp: 'clear',
							clearValue: { r: 0, g: 1, b: 1, a: 1 }, // New line
							storeOp: 'store'
						}
					]
				});
				pass.end();
				device.queue.submit([encoder.finish()]);
				
 */
				//await renderer.drawShape(1, 1, 1, 1, 1);

				//console.log(canvas.getContext('webgpu')?.getConfiguration());
				const frames = [];
				decoder.play(0);
				for (let i = 0; i < 100; ) {
					//let f;
					/* 	await decoder.decodeFrame(i)?.then((frame) => {
						if (frame) f = frame;
					}); */
					const f = decoder.run(i * 33.33333);
					if (f) {
						frames.push(f);
						//renderer?.draw(f);
					}
					i++;
					//console.log(i);

					const frame = new VideoFrame(canvas, {
						// Equally spaces frames out depending on frames per second
						timestamp: (i * 1e6) / 30,
						alpha: 'discard'
					});

					// The encode() method of the VideoEncoder interface asynchronously encodes a VideoFrame
					//videoEncoder.encode(frame);

					// The close() method of the VideoFrame interface clears all states and releases the reference to the media resource.
					frame.close();
				}

				console.log(frames);

				return;

				await videoEncoder.flush();

				muxer.finalize();

				const buffer = muxer.target.buffer;
				console.log(new Blob([buffer]));
				const blob = new Blob([buffer]);
				//onst file = new File([blob], 'name');
				const url = URL.createObjectURL(blob);
				self.postMessage({ name: 'download-link', link: url });
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
