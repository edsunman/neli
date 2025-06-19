import vertexShader from './shaders/vertex.wgsl?raw';
import shapeShader from './shaders/shape.wgsl?raw';

export class WebGPURenderer {
	#canvas: HTMLCanvasElement | null = null;
	#ctx: GPUCanvasContext | null = null;

	// Promise for `#start()`, WebGPU setup is asynchronous.
	#started: Promise<void> | null = null;

	// WebGPU state shared between setup and drawing.
	#format: GPUTextureFormat | null = null;
	#device: GPUDevice | null = null;
	#pipeline: GPURenderPipeline | null = null;
	#shapePipeline: GPURenderPipeline | null = null;
	#sampler: GPUSampler | null = null;

	#uniformArray = new Float32Array([0]);

	// Samples the external texture using generated UVs.
	static fragmentShaderSource = `
    @group(0) @binding(1) var mySampler: sampler;
    @group(0) @binding(2) var myTexture: texture_external;
    
    @fragment
    fn frag_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
      return textureSampleBaseClampToEdge(myTexture, mySampler, uv);
    }
  `;

	constructor(canvas: HTMLCanvasElement) {
		this.#canvas = canvas;
		this.#started = this.#start();
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
					code: vertexShader
				}),
				entryPoint: 'vert_main'
			},
			fragment: {
				module: this.#device.createShaderModule({
					code: WebGPURenderer.fragmentShaderSource
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

		this.blankFrame();
	}

	blankFrame() {
		if (!this.#device || !this.#pipeline || !this.#sampler || !this.#ctx || !this.#format) return;
		const encoder = this.#device.createCommandEncoder();
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.#ctx.getCurrentTexture().createView(),
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		});
		pass.end();
		this.#device.queue.submit([encoder.finish()]);
	}

	drawShape(redValue: number) {
		if (!this.#device || !this.#shapePipeline || !this.#sampler || !this.#ctx || !this.#format)
			return;

		this.#uniformArray.set([redValue], 0);

		const uniformBufferSize = Float32Array.BYTES_PER_ELEMENT; // Size for one f32
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
		//console.log(uniformBuffer);
		const uniformBindGroup = this.#device.createBindGroup({
			layout: this.#shapePipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
		});

		const commandEncoder = this.#device.createCommandEncoder();
		const textureView = this.#ctx.getCurrentTexture().createView();
		const renderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					clearValue: [0.0, 0.0, 0.0, 1.0],
					loadOp: 'clear' as GPULoadOp,
					storeOp: 'store' as GPUStoreOp
				}
			]
		};

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.#shapePipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		passEncoder.draw(6, 1, 0, 0);
		passEncoder.end();
		this.#device.queue.submit([commandEncoder.finish()]);
		return this.#device.queue.onSubmittedWorkDone();
	}

	async draw(frame: VideoFrame) {
		// Don't try to draw any frames until the context is configured.
		await this.#started;
		//console.log('frame -> ', frame);
		if (!this.#canvas || !this.#ctx) return;
		//this.#canvas.width = frame.displayWidth;
		//this.#canvas.height = frame.displayHeight;

		if (!this.#device || !this.#pipeline || !this.#sampler) return;
		const uniformBindGroup = this.#device.createBindGroup({
			layout: this.#pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 1, resource: this.#sampler },
				{ binding: 2, resource: this.#device.importExternalTexture({ source: frame }) }
			]
		});

		const commandEncoder = this.#device.createCommandEncoder();
		const textureView = this.#ctx.getCurrentTexture().createView();
		const renderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					clearValue: [0.0, 0.0, 0.0, 1.0],
					loadOp: 'clear' as GPULoadOp,
					storeOp: 'store' as GPUStoreOp
				}
			]
		};

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.#pipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		passEncoder.draw(6, 1, 0, 0);
		passEncoder.end();
		this.#device.queue.submit([commandEncoder.finish()]);

		frame.close();
	}
}
