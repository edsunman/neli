import solidColorShader from '../shaders/solidColor.wgsl?raw';

export class SolidColorRenderer {
	private device: GPUDevice;
	private sampler: GPUSampler;
	private pipeline: GPURenderPipeline;

	constructor(device: GPUDevice, format: GPUTextureFormat, sampler: GPUSampler) {
		this.device = device;
		this.pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: device.createShaderModule({
					code: solidColorShader
				}),
				entryPoint: 'vertexMain'
			},
			fragment: {
				module: device.createShaderModule({
					code: solidColorShader
				}),
				entryPoint: 'fragmentMain',
				targets: [{ format: format }]
			},
			primitive: {
				topology: 'triangle-list'
			}
		});
		this.sampler = sampler;
	}

	draw(passEncoder: GPURenderPassEncoder) {
		/* 		this.device.queue.writeBuffer(
			uniformBuffer,
			0,
			uniformArray.buffer,
			0,
			uniformArray.byteLength
		);
		const uniformBindGroup = this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: uniformBuffer } },
				{ binding: 1, resource: this.sampler },
				{ binding: 2, resource: texture.createView() }
			]
		});
 */
		passEncoder.setPipeline(this.pipeline);
		passEncoder.draw(3);
	}
}
