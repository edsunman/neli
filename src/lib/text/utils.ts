import type { Character, Characters, Font, KerningMap } from '$lib/types';

type TextMeasurements = {
	width: number;
	height: number;
	lineWidths: number[];
	printedCharCount: number;
};

export const loadFont = async (fontJsonUrl: string): Promise<Font> => {
	const response = await fetch(fontJsonUrl);
	const json = await response.json();

	const characters: Characters = {};

	for (const [i, char] of json.chars.entries()) {
		characters[char.id] = char;
		characters[char.id].charIndex = i;
	}

	// The kerning map stores a spare map of character ID pairs with an associated
	// X offset that should be applied to the character spacing when the second
	// character ID is rendered after the first.
	const kernings: KerningMap = new Map();
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

	return {
		charCount: Object.keys(characters).length,
		defaultChar: Object.values(characters)[0],
		characters,
		kernings,
		lineHeight: json.common.lineHeight
	};
};

export const measureText = (text: string, font: Font, lineSpacing: number): TextMeasurements => {
	let maxWidth = 0;
	const lineWidths: number[] = [];

	let textOffsetX = 0;
	//let textOffsetY = 0;
	//let line = 0;
	let printedCharCount = 0;
	let nextCharCode = text.charCodeAt(0);
	for (let i = 0; i < text.length; ++i) {
		const charCode = nextCharCode;
		nextCharCode = i < text.length - 1 ? text.charCodeAt(i + 1) : -1;

		switch (charCode) {
			case 10: // Newline
				lineWidths.push(textOffsetX);
				//line++;
				maxWidth = Math.max(maxWidth, textOffsetX);
				textOffsetX = 0;
				//textOffsetY -= font.lineHeight + lineHeight;
				break;
			case 13: // CR
				break;
			case 32: // Space
				// For spaces, advance the offset without actually adding a character.
				textOffsetX += getXAdvance(charCode, -1, font);
				break;
			default: {
				textOffsetX += getXAdvance(charCode, nextCharCode, font);
				printedCharCount++;
			}
		}
	}
	lineWidths.push(textOffsetX);
	maxWidth = Math.max(maxWidth, textOffsetX);

	/* 	const characterHeights = lineWidths.length * font.lineHeight;
	const lineHeightSpacing = (lineWidths.length - 1) * lineHeight; */
	const linePitch = lineSpacing * font.lineHeight;
	const height = font.lineHeight + (lineWidths.length - 1) * linePitch;

	return {
		width: maxWidth,
		height,
		lineWidths,
		printedCharCount
	};
};

// Gets the distance in pixels a line should advance for a given character code. If the upcoming
// character code is given any kerning between the two characters will be taken into account.
const getXAdvance = (charCode: number, nextCharCode: number, font: Font): number => {
	const char = getCharacterFromCode(charCode, font);
	if (nextCharCode >= 0) {
		const kerning = font.kernings.get(charCode);
		if (kerning) {
			return char.xadvance + (kerning.get(nextCharCode) ?? 0);
		}
	}
	return char.xadvance;
};

const getCharacterFromCode = (charCode: number, font: Font): Character => {
	let char = font.characters[charCode];
	if (!char) {
		char = font.defaultChar;
	}
	return char;
};
