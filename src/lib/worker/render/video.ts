import videoShader from '../shaders/video.wgsl?raw';

export class VideoRenderer {
	#device: GPUDevice;
	#sampler: GPUSampler;
	#pipeline: GPURenderPipeline;

	constructor(device: GPUDevice, format: GPUTextureFormat, sampler: GPUSampler) {
		this.#device = device;
		this.#pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: device.createShaderModule({
					code: videoShader
				}),
				entryPoint: 'vertexMain'
			},
			fragment: {
				module: device.createShaderModule({
					code: videoShader
				}),
				entryPoint: 'fragmentMain',
				targets: [{ format: format }]
			},
			primitive: {
				topology: 'triangle-list'
			}
		});
		this.#sampler = sampler;
	}

	draw(passEncoder: GPURenderPassEncoder, frame: VideoFrame, uniformArray: Float32Array) {
		const uniformBuffer = this.#device.createBuffer({
			size: uniformArray.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
		this.#device.queue.writeBuffer(
			uniformBuffer,
			0,
			uniformArray.buffer,
			0,
			uniformArray.byteLength
		);
		const uniformBindGroup = this.#device.createBindGroup({
			layout: this.#pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: uniformBuffer } },
				{ binding: 1, resource: this.#sampler },
				{ binding: 2, resource: this.#device.importExternalTexture({ source: frame }) }
			]
		});

		passEncoder.setPipeline(this.#pipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		passEncoder.draw(6, 1, 0, 0);
	}
}
