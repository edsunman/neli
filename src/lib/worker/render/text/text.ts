import type { FontGPU, MsdfTextMeasurements } from './types';
import type { CharPosition } from './types';
import { createFont, measureText } from './actions';
import msdfTextWGSL from '../../shaders/text.wgsl?raw';

// Prepared text with GPU render bundle and color/scale buffers.
export class MsdfText {
	private bufferArray = new Float32Array(8);
	private bufferArrayDirty = true;

	constructor(
		private device: GPUDevice,
		public renderBundle: GPURenderBundle,
		public measurements: MsdfTextMeasurements,
		public fontGPU: FontGPU,
		public textBuffer: GPUBuffer
	) {
		this.setColor(1, 1, 1, 1);
		this.setPixelScale(1 / 512);
	}

	getRenderBundle(): GPURenderBundle {
		if (this.bufferArrayDirty) {
			this.bufferArrayDirty = false;
			this.device.queue.writeBuffer(
				this.textBuffer,
				0,
				this.bufferArray,
				0,
				this.bufferArray.length
			);
		}
		return this.renderBundle;
	}

	setColor(r: number, g: number, b: number, a: number = 1.0) {
		this.bufferArray[0] = r;
		this.bufferArray[1] = g;
		this.bufferArray[2] = b;
		this.bufferArray[3] = a;
		this.bufferArrayDirty = true;
	}

	setPixelScale(pixelScale: number) {
		this.bufferArray[4] = pixelScale;
		this.bufferArrayDirty = true;
	}
}

// Orchestrates font loading, text preparation, and GPU rendering.
export class MsdfTextRenderer {
	private pipeline: MsdfPipeline;
	private device: GPUDevice;
	private renderBundleDescriptor: GPURenderBundleEncoderDescriptor;

	constructor(device: GPUDevice, colorFormat: GPUTextureFormat) {
		this.device = device;
		this.pipeline = new MsdfPipeline(device, colorFormat);
		this.renderBundleDescriptor = { colorFormats: [colorFormat] };
	}

	async createFont(fontJsonUrl: string): Promise<FontGPU> {
		return createFont(this.device, this.pipeline, fontJsonUrl);
	}

	prepareText(
		fontGPU: FontGPU,
		text: string,
		params: number[],
		uniformArray: Float32Array,
		uniformBuffer: GPUBuffer
	): MsdfText {
		const textBuffer = this.device.createBuffer({
			label: 'msdf text buffer',
			size: (text.length + 6) * Float32Array.BYTES_PER_ELEMENT * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true
		});

		const textArray = new Float32Array(textBuffer.getMappedRange());
		let offset = 8;

		const fontData = fontGPU.data;
		const measurements = measureText(fontData, text, params[7]);

		measureText(fontData, text, params[7], (pos: CharPosition) => {
			let textX = pos.x;
			if (params[8] === 1) {
				textX = textX + (measurements.width - measurements.lineWidths[pos.line]) / 2;
			}
			if (params[8] === 2) {
				textX = textX + (measurements.width - measurements.lineWidths[pos.line]);
			}

			textX = textX - measurements.width / 2;
			textArray[offset] = textX;
			textArray[offset + 1] = pos.y + measurements.height * 0.5;
			textArray[offset + 2] = pos.charIndex;
			offset += 4;
		});

		textBuffer.unmap();

		this.device.queue.writeBuffer(
			uniformBuffer,
			0,
			uniformArray.buffer,
			0,
			uniformArray.byteLength
		);

		const bindGroup = this.device.createBindGroup({
			label: 'msdf text bind group',
			layout: this.pipeline.textBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: uniformBuffer } },
				{ binding: 1, resource: { buffer: textBuffer } }
			]
		});

		const encoder = this.device.createRenderBundleEncoder(this.renderBundleDescriptor);
		encoder.setPipeline(fontGPU.pipeline);
		encoder.setBindGroup(0, fontGPU.bindGroup);
		encoder.setBindGroup(1, bindGroup);
		encoder.draw(4, measurements.printedCharCount);
		const renderBundle = encoder.finish();

		const msdfText = new MsdfText(this.device, renderBundle, measurements, fontGPU, textBuffer);

		msdfText.setPixelScale(params[6] / 5000);
		msdfText.setColor(params[9], params[10], params[11]);

		return msdfText;
	}

	draw(renderPass: GPURenderPassEncoder, text: MsdfText[]) {
		const renderBundles = text.map((t) => t.getRenderBundle());
		renderPass.executeBundles(renderBundles);
	}
}

// Creates GPU pipeline, samplers, and bind group layouts for MSDF text.
export class MsdfPipeline {
	readonly fontBindGroupLayout: GPUBindGroupLayout;
	readonly textBindGroupLayout: GPUBindGroupLayout;
	readonly sampler: GPUSampler;
	readonly pipelinePromise: Promise<GPURenderPipeline>;

	constructor(device: GPUDevice, colorFormat: GPUTextureFormat) {
		this.sampler = device.createSampler({
			label: 'MSDF text sampler',
			minFilter: 'linear',
			magFilter: 'linear',
			mipmapFilter: 'linear',
			maxAnisotropy: 16
		});

		this.fontBindGroupLayout = device.createBindGroupLayout({
			label: 'MSDF font group layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {}
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {}
				},
				{
					binding: 2,
					visibility: GPUShaderStage.VERTEX,
					buffer: { type: 'read-only-storage' }
				}
			]
		});

		this.textBindGroupLayout = device.createBindGroupLayout({
			label: 'MSDF text group layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {}
				},
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: 'read-only-storage' }
				}
			]
		});

		const shaderModule = device.createShaderModule({
			label: 'MSDF text shader',
			code: msdfTextWGSL
		});

		this.pipelinePromise = device.createRenderPipelineAsync({
			label: `msdf text pipeline`,
			layout: device.createPipelineLayout({
				bindGroupLayouts: [this.fontBindGroupLayout, this.textBindGroupLayout]
			}),
			vertex: {
				module: shaderModule,
				entryPoint: 'vertexMain'
			},
			fragment: {
				module: shaderModule,
				entryPoint: 'fragmentMain',
				targets: [
					{
						format: colorFormat,
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
				topology: 'triangle-strip',
				stripIndexFormat: 'uint32'
			}
		});
	}
}
