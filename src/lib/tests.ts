import { createClip } from './clip/actions';
import { Source } from './source/source.svelte';
import { appState } from './state.svelte';
import { extendTimeline } from './timeline/actions';
import type { SourceType } from './types';

export const setupTests = () => {
	if (!window) return;

	// @ts-expect-error append function to window
	window.tests = { lotsOfClips, addSource };
};

const lotsOfClips = () => {
	extendTimeline(7500);
	const textSource = appState.sources.find((s) => s.type === 'text');
	const testSource = appState.sources.find((s) => s.type === 'test');
	if (!textSource || !testSource) return;
	for (let i = 0; i < 150; i++) {
		createClip(textSource.id, 1, i * 50, 50);
		createClip(testSource.id, 2, i * 50, 50);
	}
};

const addSource = (type: SourceType, count = 1, name = 'test') => {
	for (let i = 0; i < count; i++) {
		const newSource = new Source(type);
		newSource.name = name;
		appState.sources.push(newSource);
	}
};
