import { appState } from '$lib/state.svelte';

export const closePalette = () => {
	if (appState.palette.lock) return;
	appState.palette.open = false;
	appState.palette.shrink = '';
	appState.progress.started = false;
	appState.import.importStarted = false;
	appState.disableKeyboardShortcuts = false;
};
