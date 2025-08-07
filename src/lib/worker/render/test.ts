import testShader from '../shaders/test.wgsl?raw';

export class TestRenderer {
	#pipeline: GPURenderPipeline;
	#device: GPUDevice;

	constructor(device: GPUDevice, format: GPUTextureFormat) {
		this.#device = device;
		this.#pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: device.createShaderModule({
					code: testShader
				}),
				entryPoint: 'vertexMain'
			},
			fragment: {
				module: device.createShaderModule({
					code: testShader
				}),
				entryPoint: 'fragmentMain',
				targets: [{ format: format }]
			},
			primitive: {
				topology: 'triangle-list'
			}
		});
	}

	draw(passEncoder: GPURenderPassEncoder, uniformArray: Float32Array) {
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
		const bindGroup = this.#device.createBindGroup({
			layout: this.#pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
		});

		passEncoder.setPipeline(this.#pipeline);
		passEncoder.setBindGroup(0, bindGroup);
		// Draw 6 vertices for each of the 5 instances
		passEncoder.draw(6, 5);
	}
}
