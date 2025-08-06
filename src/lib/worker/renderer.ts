import videoShader from './shaders/video.wgsl?raw';
import shapeShader from './shaders/shape.wgsl?raw';
import testShader from './shaders/test.wgsl?raw';

export class WebGPURenderer {
	#canvas: OffscreenCanvas | undefined;
	#ctx: GPUCanvasContext | null = null;

	#format: GPUTextureFormat | undefined;
	#device: GPUDevice | undefined;
	#pipeline: GPURenderPipeline | undefined;
	#shapePipeline: GPURenderPipeline | undefined;
	#testPipeline: GPURenderPipeline | undefined;
	#sampler: GPUSampler | undefined;
	#commandEncoder: GPUCommandEncoder | undefined;

	#pendingFrames: VideoFrame[] = [];

	bitmap: ImageBitmap | undefined;

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

		this.#testPipeline = this.#device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: this.#device.createShaderModule({
					code: testShader
				}),
				entryPoint: 'vert_main'
			},
			fragment: {
				module: this.#device.createShaderModule({
					code: testShader
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

	async endPaint() {
		if (!this.#device || !this.#commandEncoder || !this.#canvas) return;
		this.#device.queue.submit([this.#commandEncoder.finish()]);

		this.bitmap = await createImageBitmap(this.#canvas);

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

	shapePass(frameNumber: number, params: number[]) {
		if (
			!this.#device ||
			!this.#shapePipeline ||
			!this.#sampler ||
			!this.#ctx ||
			!this.#commandEncoder
		)
			return;

		this.#uniformArray.set([frameNumber, 0, params[0], params[1], params[2], params[3]], 0);
		const uniformBuffer = this.#device.createBuffer({
			size: this.#uniformArray.byteLength,
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

	testPass(frameNumber: number, params: number[]) {
		if (
			!this.#device ||
			!this.#testPipeline ||
			!this.#sampler ||
			!this.#ctx ||
			!this.#commandEncoder
		)
			return;

		this.#uniformArray.set([frameNumber, 0, params[0], params[1], params[2], params[3]], 0);
		const uniformBuffer = this.#device.createBuffer({
			size: this.#uniformArray.byteLength,
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
			layout: this.#testPipeline.getBindGroupLayout(0),
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
		passEncoder.setPipeline(this.#testPipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		// Draw 6 vertices for each of the 4 instances
		passEncoder.draw(6, 5);
		passEncoder.end();
	}

	videoPass(frame: VideoFrame, params: number[]) {
		if (!this.#ctx || !this.#device || !this.#pipeline || !this.#sampler || !this.#commandEncoder)
			return;

		this.#uniformArray.set([0, 0, params[0], params[1], params[2], params[3]], 0);

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
