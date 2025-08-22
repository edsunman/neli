import { MsdfFont, MsdfTextRenderer } from './render/text';
import { TestRenderer } from './render/test';
import { VideoRenderer } from './render/video';

export class WebGPURenderer {
	#canvas?: OffscreenCanvas;
	#ctx: GPUCanvasContext | null = null;

	#format?: GPUTextureFormat;
	#device?: GPUDevice;
	#sampler?: GPUSampler;
	#commandEncoder?: GPUCommandEncoder;
	#passEncoder?: GPURenderPassEncoder;

	#font?: MsdfFont;
	#testFont?: MsdfFont;
	#textRenderer?: MsdfTextRenderer;
	#testRenderer?: TestRenderer;
	#videoRenderer?: VideoRenderer;

	#pendingFrames: VideoFrame[] = [];
	bitmap?: ImageBitmap;
	#uniformArray = new Float32Array([0, 0, 0, 0, 0, 0]);

	constructor(canvas: OffscreenCanvas) {
		this.#canvas = canvas;
		this.#start();
	}

	async #start() {
		if (!navigator.gpu) {
			throw Error('WebGPU not supported.');
		}
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) return;
		this.#device = await adapter.requestDevice();
		this.#format = navigator.gpu.getPreferredCanvasFormat();

		if (!this.#canvas) return;
		this.#ctx = this.#canvas.getContext('webgpu');

		if (!this.#ctx) return;
		this.#ctx.configure({
			device: this.#device,
			format: this.#format,
			alphaMode: 'opaque'
		});

		this.#sampler = this.#device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

		this.#testRenderer = new TestRenderer(this.#device, this.#format);
		this.#videoRenderer = new VideoRenderer(this.#device, this.#format, this.#sampler);
		this.#textRenderer = new MsdfTextRenderer(this.#device, this.#format);
		this.#font = await this.#textRenderer.createFont('/text.json');
		this.#testFont = await this.#textRenderer.createFont('/FiraMono-Bold-msdf.json');

		this.startPaint();
		this.endPaint();
	}

	startPaint() {
		if (!this.#device || !this.#ctx) return;
		this.#commandEncoder = this.#device.createCommandEncoder();
		this.blankFramePass();
		const textureView = this.#ctx.getCurrentTexture().createView();
		const renderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'load' as GPULoadOp,
					storeOp: 'store' as GPUStoreOp
				}
			]
		};
		this.#passEncoder = this.#commandEncoder.beginRenderPass(renderPassDescriptor);
	}

	async endPaint(createBitmap = false) {
		if (!this.#device || !this.#commandEncoder || !this.#canvas || !this.#passEncoder) return;
		this.#passEncoder.end();
		this.#device.queue.submit([this.#commandEncoder.finish()]);

		// TODO: do we only need to do when encoding?
		if (createBitmap) {
			this.bitmap = await createImageBitmap(this.#canvas);
		}

		for (let i = 1; i < this.#pendingFrames.length; i++) {
			const frame = this.#pendingFrames.shift();
			frame?.close();
		}

		return this.#device.queue.onSubmittedWorkDone();
	}

	blankFramePass() {
		if (!this.#commandEncoder || !this.#ctx) return;
		const pass = this.#commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.#ctx.getCurrentTexture().createView(),
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		});
		pass.end();
	}

	textPass(frameNumber: number, params: number[], inputText: string) {
		if (!this.#textRenderer || !this.#font || !this.#passEncoder) return;
		const text = this.#textRenderer.prepareText(
			this.#font,
			inputText,
			{
				centered: true,
				lineHeight: 0,
				pixelScale: 1 / 100,
				color: [1, 1, 1, 1]
			},
			params
		);
		this.#textRenderer.render(this.#passEncoder, [text]);
	}

	testPass(frameNumber: number, params: number[]) {
		if (!this.#passEncoder || !this.#textRenderer || !this.#testFont) return;

		this.#uniformArray.set([frameNumber, 0, params[0], params[1], params[2], params[3]], 0);
		this.#testRenderer?.draw(this.#passEncoder, this.#uniformArray);

		const FF = frameNumber % 30;
		const seconds = (frameNumber - FF) / 30;
		const SS = seconds % 60;
		const minutes = (seconds - SS) / 60;
		const MM = minutes % 60;
		const t =
			String(MM).padStart(2, '0') +
			':' +
			String(SS).padStart(2, '0') +
			':' +
			String(FF).padStart(2, '0');
		const text = this.#textRenderer.prepareText(
			this.#testFont,
			t,
			{
				centered: true,
				lineHeight: 0,
				pixelScale: 1 / 150,
				color: [1, 1, 1, 1]
			},
			params
		);
		this.#textRenderer.render(this.#passEncoder, [text]);
	}

	videoPass(frame: VideoFrame, params: number[], height: number, width: number) {
		if (!this.#passEncoder) return;

		this.#uniformArray.set([0, 0, height, width, params[2], params[3]], 0);
		this.#videoRenderer?.draw(this.#passEncoder, frame, this.#uniformArray);

		this.#pendingFrames.push(frame);
	}
}
