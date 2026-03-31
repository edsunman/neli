import commonShader from '../shaders/common.wgsl?raw';
import videoShader from '../shaders/video.wgsl?raw';

export class VideoRenderer {
	private device: GPUDevice;
	private sampler: GPUSampler;
	private pipeline: GPURenderPipeline;

	constructor(device: GPUDevice, format: GPUTextureFormat, sampler: GPUSampler) {
		this.device = device;
		this.pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: device.createShaderModule({
					code: `${commonShader}\n${videoShader}`
				}),
				entryPoint: 'vertexMain'
			},
			fragment: {
				module: device.createShaderModule({
					code: `${commonShader}\n${videoShader}`
				}),
				entryPoint: 'fragmentMain',
				targets: [
					{
						format: format,
						blend: {
							color: {
								srcFactor: 'src-alpha',
								dstFactor: 'one-minus-src-alpha'
							},
							alpha: {
								srcFactor: 'one',
								dstFactor: 'one'
							}
						}
					}
				]
			},
			primitive: {
				topology: 'triangle-list'
			}
		});
		this.sampler = sampler;
	}

	draw(
		passEncoder: GPURenderPassEncoder,
		frame: VideoFrame,
		uniformArray: Float32Array,
		uniformBuffer: GPUBuffer
	) {
		this.device.queue.writeBuffer(
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
				{ binding: 2, resource: this.device.importExternalTexture({ source: frame }) }
			]
		});

		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		passEncoder.draw(6, 1, 0, 0);
	}
}
