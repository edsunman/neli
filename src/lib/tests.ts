import { createClip } from './clip/actions';
import { appState } from './state.svelte';

export const setupTests = () => {
	if (!window) return;

	// @ts-expect-error append function to window
	window.lotsOfClips = lotsOfClips;
};

const lotsOfClips = () => {
	const textSource = appState.sources.find((s) => s.type === 'text');
	const testSource = appState.sources.find((s) => s.type === 'test');
	if (!textSource || !testSource) return;
	for (let i = 0; i < 150; i++) {
		createClip(textSource.id, 1, i * 50, 50);
		createClip(testSource.id, 2, i * 50, 50);
		createClip(testSource.id, 3, i * 50, 50);
	}
};
