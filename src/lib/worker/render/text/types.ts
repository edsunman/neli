// Consolidated types for the text rendering module.

export type KerningMap = Map<number, Map<number, number>>;

export type MsdfChar = {
	id: number;
	index: number;
	char: string;
	width: number;
	height: number;
	xoffset: number;
	yoffset: number;
	xadvance: number;
	chnl: number;
	x: number;
	y: number;
	page: number;
	charIndex: number;
};

export type MsdfCharData = {
	width: number;
	height: number;
	xoffset: number;
	yoffset: number;
	xadvance: number;
};

export type FontGPU = {
	pipeline: GPURenderPipeline;
	bindGroup: GPUBindGroup;
	charsBuffer: GPUBuffer;
	bindGroupLayout: GPUBindGroupLayout;
	data: FontData;
};

export type MsdfTextMeasurements = {
	width: number;
	height: number;
	lineWidths: number[];
	printedCharCount: number;
	wordCount: number;
};

export type CharacterDetails = {
	x: number;
	y: number;
	line: number;
	charIndex: number;
	word: number;
};

export type MsdfTextFormattingOptions = {
	justify?: 'left' | 'center' | 'right';
	pixelScale?: number;
	lineHeight?: number;
	color?: [number, number, number, number];
};

export type FontData = {
	charCount: number;
	defaultChar: MsdfChar;
	lineHeight: number;
	chars: { [x: number]: MsdfChar };
	kernings: KerningMap;
};
