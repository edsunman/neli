import testShader from '../shaders/test.wgsl?raw';

export class TestRenderer {
	private pipeline: GPURenderPipeline;
	private device: GPUDevice;

	constructor(device: GPUDevice, format: GPUTextureFormat) {
		this.device = device;
		this.pipeline = device.createRenderPipeline({
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
				targets: [
					{
						format: format,
						blend: {
							color: {
								srcFactor: 'src-alpha',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							},
							alpha: {
								srcFactor: 'one',
								dstFactor: 'zero',
								operation: 'add'
							}
						}
					}
				]
			},
			primitive: {
				topology: 'triangle-list'
			}
		});
	}

	draw(passEncoder: GPURenderPassEncoder, uniformArray: Float32Array, uniformBuffer: GPUBuffer) {
		this.device.queue.writeBuffer(
			uniformBuffer,
			0,
			uniformArray.buffer,
			0,
			uniformArray.byteLength
		);
		const bindGroup = this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
		});

		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, bindGroup);
		// Draw 6 vertices for each of the 32 instances
		passEncoder.draw(6, 32);
	}
}
