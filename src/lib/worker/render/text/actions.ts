import type {
	CharacterDetails,
	FontData,
	FontGPU,
	KerningMap,
	MsdfChar,
	MsdfTextMeasurements
} from './types';
import type { MsdfPipeline } from './text';

// Loads texture from URL and uploads to GPU.
const loadTexture = async (device: GPUDevice, url: string): Promise<GPUTexture> => {
	const response = await fetch(url);
	const imageBitmap = await createImageBitmap(await response.blob());

	const texture = device.createTexture({
		label: `MSDF font texture ${url}`,
		size: [imageBitmap.width, imageBitmap.height, 1],
		format: 'rgba8unorm',
		usage:
			GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
	});
	device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture }, [
		imageBitmap.width,
		imageBitmap.height
	]);
	return texture;
};

// Loads font JSON + texture atlas and creates FontGPU.
export const createFont = async (
	device: GPUDevice,
	factory: MsdfPipeline,
	fontJsonUrl: string
): Promise<FontGPU> => {
	const response = await fetch(fontJsonUrl);
	const json = await response.json();

	const i = fontJsonUrl.lastIndexOf('/');
	const baseUrl = i !== -1 ? fontJsonUrl.substring(0, i + 1) : undefined;

	const pagePromises = json.pages.map((pageUrl: string) => loadTexture(device, baseUrl + pageUrl));

	const charCount = json.chars.length;
	const charsBuffer = device.createBuffer({
		label: 'MSDF character layout buffer',
		size: charCount * Float32Array.BYTES_PER_ELEMENT * 8,
		usage: GPUBufferUsage.STORAGE,
		mappedAtCreation: true
	});

	const charsArray = new Float32Array(charsBuffer.getMappedRange());

	const u = 1 / json.common.scaleW;
	const v = 1 / json.common.scaleH;

	const chars: {
		[x: number]: {
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
	} = {};

	let offset = 0;
	for (const [i, char] of json.chars.entries()) {
		chars[char.id] = char;
		chars[char.id].charIndex = i;
		charsArray[offset] = char.x * u;
		charsArray[offset + 1] = char.y * v;
		charsArray[offset + 2] = char.width * u;
		charsArray[offset + 3] = char.height * v;
		charsArray[offset + 4] = char.width;
		charsArray[offset + 5] = char.height;
		charsArray[offset + 6] = char.xoffset;
		charsArray[offset + 7] = -char.yoffset;
		offset += 8;
	}

	charsBuffer.unmap();

	const pageTextures = await Promise.all(pagePromises);

	const bindGroup = device.createBindGroup({
		label: 'msdf font bind group',
		layout: factory.fontBindGroupLayout,
		entries: [
			{ binding: 0, resource: pageTextures[0].createView() },
			{ binding: 1, resource: factory.sampler },
			{ binding: 2, resource: { buffer: charsBuffer } }
		]
	});

	const kernings = new Map();

	if (json.kernings) {
		for (const kearning of json.kernings) {
			let charKerning = kernings.get(kearning.first);
			if (!charKerning) {
				charKerning = new Map<number, number>();
				kernings.set(kearning.first, charKerning);
			}
			charKerning.set(kearning.second, kearning.amount);
		}
	}

	const fontData = createFontData(json.common.lineHeight, chars, kernings);
	const pipeline = await factory.pipelinePromise;

	return {
		pipeline,
		bindGroup,
		charsBuffer,
		bindGroupLayout: factory.fontBindGroupLayout,
		data: fontData
	};
};

function createFontData(
	lineHeight: number,
	chars: { [x: number]: MsdfChar },
	kernings: KerningMap
): FontData {
	const charArray = Object.values(chars);
	return {
		charCount: charArray.length,
		defaultChar: charArray[0],
		lineHeight,
		chars,
		kernings
	};
}

export const measureText = (font: FontData, text: string, lineSpacing: number) => {
	const characters: CharacterDetails[] = [];
	let maxWidth = 0;
	const lineWidths: number[] = [];

	let textOffsetX = 0;
	let textOffsetY = 0;
	let line = 0;
	let printedCharCount = 0;
	let nextCharCode = text.charCodeAt(0);
	let word = 0;
	let inWord = false;

	for (let i = 0; i < text.length; ++i) {
		const charCode = nextCharCode;
		nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;

		switch (charCode) {
			case 10: // Newline
				lineWidths.push(textOffsetX);
				line++;
				maxWidth = Math.max(maxWidth, textOffsetX);
				textOffsetX = 0;
				textOffsetY -= font.lineHeight * lineSpacing;
				inWord = false;
				break;
			case 13: // CR
				break;
			case 32: // Space
				textOffsetX += getXAdvance(font, charCode);
				inWord = false;
				break;
			default: {
				if (!inWord) {
					word++;
					inWord = true;
				}
				const char = getChar(font, charCode);
				characters.push({ x: textOffsetX, y: textOffsetY, line, charIndex: char.charIndex, word });
				textOffsetX += getXAdvance(font, charCode, nextCharCode);
				printedCharCount++;
			}
		}
	}

	lineWidths.push(textOffsetX);
	maxWidth = Math.max(maxWidth, textOffsetX);

	const linePitch = lineSpacing * font.lineHeight;
	const height = font.lineHeight + (lineWidths.length - 1) * linePitch;

	return {
		measurements: { width: maxWidth, height, lineWidths, printedCharCount, wordCount: word },
		characters
	};
};

function getChar(fontData: FontData, charCode: number): MsdfChar {
	return fontData.chars[charCode] ?? fontData.defaultChar;
}

function getXAdvance(fontData: FontData, charCode: number, nextCharCode: number = -1): number {
	const char = getChar(fontData, charCode);
	if (nextCharCode >= 0) {
		const kerning = fontData.kernings.get(charCode);
		if (kerning) {
			return char.xadvance + (kerning.get(nextCharCode) ?? 0);
		}
	}
	return char.xadvance;
}
