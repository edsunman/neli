import type { Clip } from '$lib/clip/clip.svelte';
import { appState } from '$lib/state.svelte';

export const showClipPropertiesSection = (clip: Clip) => {
	const type = clip.source.type;
	if (type === 'audio') {
		appState.propertiesSection = 'audio';
		return;
	}
	if (type === 'text') {
		if (appState.propertiesSavedSection === 'layout') {
			appState.propertiesSection = 'layout';
			return;
		}
		appState.propertiesSection = 'text';
		return;
	}
	if (type === 'video') {
		if (
			appState.propertiesSavedSection === 'colour' ||
			appState.propertiesSavedSection === 'crop' ||
			appState.propertiesSavedSection === 'audio'
		) {
			appState.propertiesSection = appState.propertiesSavedSection;
			return;
		}
		appState.propertiesSection = 'layout';
		return;
	}
	appState.propertiesSection = 'layout';
};
