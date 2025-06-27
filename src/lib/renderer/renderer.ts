import videoShader from './shaders/video.wgsl?raw';
import shapeShader from './shaders/shape.wgsl?raw';

export class WebGPURenderer {
	#canvas: OffscreenCanvas | null = null;
	#ctx: GPUCanvasContext | null = null;

	#format: GPUTextureFormat | null = null;
	#device: GPUDevice | null = null;
	#pipeline: GPURenderPipeline | null = null;
	#shapePipeline: GPURenderPipeline | null = null;
	#sampler: GPUSampler | null = null;
	#commandEncoder: GPUCommandEncoder | null = null;

	#pendingFrames: VideoFrame[] = [];

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

		this.#shapePipeline = this.#device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: this.#device.createShaderModule({
					code: shapeShader
				}),
				entryPoint: 'vert_main'
			},
			fragment: {
				module: this.#device.createShaderModule({
					code: shapeShader
				}),
				entryPoint: 'frag_main',
				targets: [{ format: this.#format }]
			},
			primitive: {
				topology: 'triangle-list'
			}
		});

		this.#pipeline = this.#device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: this.#device.createShaderModule({
					code: videoShader
				}),
				entryPoint: 'vert_main'
			},
			fragment: {
				module: this.#device.createShaderModule({
					code: videoShader
				}),
				entryPoint: 'frag_main',
				targets: [{ format: this.#format }]
			},
			primitive: {
				topology: 'triangle-list'
			}
		});

		// Default sampler configuration is nearset + clamp.
		this.#sampler = this.#device.createSampler({});

		this.startPaint();
		this.blankFramePass();
		this.endPaint();
	}

	startPaint() {
		if (!this.#device) return;
		this.#commandEncoder = this.#device.createCommandEncoder();
		this.blankFramePass();
	}

	endPaint() {
		if (!this.#device || !this.#commandEncoder) return;
		this.#device.queue.submit([this.#commandEncoder.finish()]);

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

	shapePass(
		redValue: number,
		scaleX: number,
		scaleY: number,
		positionX: number,
		positionY: number
	) {
		if (
			!this.#device ||
			!this.#shapePipeline ||
			!this.#sampler ||
			!this.#ctx ||
			!this.#commandEncoder
		)
			return;

		this.#uniformArray.set([redValue, 0, scaleX, scaleY, positionX, positionY], 0);

		const uniformBufferSize = Float32Array.BYTES_PER_ELEMENT * 6; // Size for three f32
		const uniformBuffer = this.#device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.#device.queue.writeBuffer(
			uniformBuffer,
			0,
			this.#uniformArray.buffer,
			0,
			this.#uniformArray.byteLength
		);

		const uniformBindGroup = this.#device.createBindGroup({
			layout: this.#shapePipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
		});

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

		const passEncoder = this.#commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.#shapePipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		passEncoder.draw(6, 1, 0, 0);
		passEncoder.end();
	}

	videoPass(
		frame: VideoFrame,
		scaleX: number,
		scaleY: number,
		positionX: number,
		positionY: number
	) {
		if (!this.#ctx || !this.#device || !this.#pipeline || !this.#sampler || !this.#commandEncoder)
			return;

		this.#uniformArray.set([0, 0, scaleX, scaleY, positionX, positionY], 0);

		const uniformBufferSize = Float32Array.BYTES_PER_ELEMENT * 6; // Size for three f32
		const uniformBuffer = this.#device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.#device.queue.writeBuffer(
			uniformBuffer,
			0,
			this.#uniformArray.buffer,
			0,
			this.#uniformArray.byteLength
		);

		const uniformBindGroup = this.#device.createBindGroup({
			layout: this.#pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: uniformBuffer } },
				{ binding: 1, resource: this.#sampler },
				{ binding: 2, resource: this.#device.importExternalTexture({ source: frame }) }
			]
		});

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

		const passEncoder = this.#commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.#pipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		passEncoder.draw(6, 1, 0, 0);
		passEncoder.end();

		this.#pendingFrames.push(frame);
	}
}
