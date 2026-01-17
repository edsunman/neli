import type { Clip } from '$lib/clip/clip.svelte';
import { appState } from '$lib/state.svelte';

export const showClipPropertiesSection = (clip: Clip) => {
	const type = clip.source.type;
	if (type === 'audio') {
		appState.propertiesSection = 'audio';
		return;
	}
	if (type === 'text') {
		appState.propertiesSection = 'text';
		return;
	}
	//if ((type === 'video' || type === 'test') && previousSelected === 'audio') return 'audio';
	appState.propertiesSection = 'layout';
};
