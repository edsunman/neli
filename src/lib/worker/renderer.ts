import { MsdfFont, MsdfTextRenderer } from './render/text';
import { TestRenderer } from './render/test';
import { VideoRenderer } from './render/video';
import { ImageRenderer } from './render/image';

export class WebGPURenderer {
	bitmap?: ImageBitmap;

	private canvas?: OffscreenCanvas;
	private ctx: GPUCanvasContext | null = null;

	private format?: GPUTextureFormat;
	private device?: GPUDevice;
	private sampler?: GPUSampler;
	private commandEncoder?: GPUCommandEncoder;
	private passEncoder?: GPURenderPassEncoder;

	private font?: MsdfFont;
	private testFont?: MsdfFont;
	private textRenderer?: MsdfTextRenderer;
	private testRenderer?: TestRenderer;
	private videoRenderer?: VideoRenderer;
	private imageRenderer?: ImageRenderer;

	private uniformArray = new Float32Array([0, 0, 0, 0, 0, 0]);
	private uniformBuffers: GPUBuffer[] = [];

	private loadedTextures = new Map<string, GPUTexture>();

	constructor(canvas: OffscreenCanvas) {
		this.canvas = canvas;
		this.start();
	}

	async start() {
		if (!navigator.gpu) {
			throw Error('WebGPU not supported.');
		}
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) return;
		this.device = await adapter.requestDevice();
		this.format = navigator.gpu.getPreferredCanvasFormat();

		if (!this.canvas) return;
		this.ctx = this.canvas.getContext('webgpu');

		if (!this.ctx) return;
		this.ctx.configure({
			device: this.device,
			format: this.format,
			alphaMode: 'opaque'
		});

		this.sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

		this.testRenderer = new TestRenderer(this.device, this.format);
		this.videoRenderer = new VideoRenderer(this.device, this.format, this.sampler);
		this.imageRenderer = new ImageRenderer(this.device, this.format, this.sampler);
		this.textRenderer = new MsdfTextRenderer(this.device, this.format);
		this.font = await this.textRenderer.createFont('/text.json');
		this.testFont = await this.textRenderer.createFont('/FiraMono-Bold-msdf.json');

		for (let i = 0; i < 4; i++) {
			const uniformBuffer = this.device.createBuffer({
				size: this.uniformArray.byteLength,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			});
			this.uniformBuffers.push(uniformBuffer);
		}

		this.startPaint();
		this.endPaint();
	}

	startPaint() {
		if (!this.device || !this.ctx) return;
		this.commandEncoder = this.device.createCommandEncoder();
		this.blankFramePass();
		const textureView = this.ctx.getCurrentTexture().createView();
		const renderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'load' as GPULoadOp,
					storeOp: 'store' as GPUStoreOp
				}
			]
		};
		this.passEncoder = this.commandEncoder.beginRenderPass(renderPassDescriptor);
	}

	async endPaint(createBitmap = false) {
		if (!this.device || !this.commandEncoder || !this.canvas || !this.passEncoder) return;
		this.passEncoder.end();
		this.device.queue.submit([this.commandEncoder.finish()]);

		if (createBitmap) {
			this.bitmap = await createImageBitmap(this.canvas);
		}

		return this.device.queue.onSubmittedWorkDone();
	}

	blankFramePass() {
		if (!this.commandEncoder || !this.ctx) return;
		const pass = this.commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.ctx.getCurrentTexture().createView(),
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		});
		pass.end();
	}

	textPass(trackNumber: number, params: number[], inputText: string) {
		if (!this.textRenderer || !this.font || !this.passEncoder) return;
		this.uniformArray.set([1, 0, params[0], params[1], params[2], params[3]]);
		const text = this.textRenderer.prepareText(
			this.font,
			inputText,
			params,
			this.uniformArray,
			this.uniformBuffers[trackNumber - 1]
		);
		this.textRenderer.draw(this.passEncoder, [text]);
	}

	testPass(trackNumber: number, frameNumber: number, params: number[]) {
		if (!this.passEncoder || !this.textRenderer || !this.testFont) return;

		this.uniformArray.set([frameNumber, 0, params[0], params[1], params[2], params[3]], 0);
		this.testRenderer?.draw(
			this.passEncoder,
			this.uniformArray,
			this.uniformBuffers[trackNumber - 1]
		);

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

		params[6] = 35;
		const text = this.textRenderer.prepareText(
			this.testFont,
			t,
			params,
			this.uniformArray,
			this.uniformBuffers[trackNumber - 1]
		);
		this.textRenderer.draw(this.passEncoder, [text]);
	}

	videoPass(
		trackNumber: number,
		frame: VideoFrame,
		params: number[],
		height: number,
		width: number
	) {
		if (!this.passEncoder) return;
		this.uniformArray.set([0, 0, height, width, params[2], params[3]], 0);
		this.videoRenderer?.draw(
			this.passEncoder,
			frame,
			this.uniformArray,
			this.uniformBuffers[trackNumber - 1]
		);
	}

	imagePass(
		trackNumber: number,
		sourceId: string,
		params: number[],
		height: number,
		width: number
	) {
		const texture = this.loadedTextures.get(sourceId);
		if (!this.passEncoder || !texture) return;
		this.uniformArray.set([0, 0, height, width, params[2], params[3]], 0);
		this.imageRenderer?.draw(
			this.passEncoder,
			texture,
			this.uniformArray,
			this.uniformBuffers[trackNumber - 1]
		);
	}

	loadTexture(image: ImageBitmap, soruceId: string) {
		if (!this.device) return;
		const texture = this.device.createTexture({
			label: 'test-texture',
			format: 'rgba8unorm',
			size: [image.width, image.height],
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT
		});
		this.device.queue.copyExternalImageToTexture(
			{ source: image, flipY: false },
			{ texture: texture },
			{ width: image.width, height: image.height }
		);
		this.loadedTextures.set(soruceId, texture);
	}
}
