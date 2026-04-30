import type { TextEffect } from './types';

export const fadeInEffect: TextEffect = {
	apply(state, character, layout, progress) {
		const totalWords = layout.wordCount;
		const stagger = 0.2;

		const duration = totalWords > 1 ? 1 / (1 + (totalWords - 1) * stagger) : 1;
		const delayPerWord = duration * stagger;
		const wordIndex = character.word - 1;
		const wordStart = wordIndex * delayPerWord;

		const rawFade = Math.max(0, Math.min(1, (progress - wordStart) / duration));

		const wordFade =
			rawFade < 0.5 ? 4 * rawFade * rawFade * rawFade : 1 - Math.pow(-2 * rawFade + 2, 3) / 2;

		const riseDistance = 50;
		const currentRise = (1 - wordFade) * riseDistance;

		const horizon = layout.fontLineHeight + 5;
		const characterBottom = (character.yOffset || 0) + character.height;
		const currentBottomPosition = characterBottom + currentRise;

		const pixelsSubmerged = Math.max(0, currentBottomPosition - horizon);

		let wordCrop = (character.height - pixelsSubmerged) / character.height;
		wordCrop = Math.max(0, Math.min(1, wordCrop));

		if (rawFade <= 0) {
			state.y -= riseDistance;
			state.scale = 0;
		} else if (rawFade >= 1) {
			state.scale = 1;
		} else {
			state.y -= currentRise;
			state.scale = wordCrop;
		}
	}
};
