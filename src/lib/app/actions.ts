import { setupProjectManager } from '$lib/project/actions';
import { appState, workerManager } from '$lib/state.svelte';
import { setupTests } from '$lib/tests';
import { loadFont } from '$lib/text/utils';

export const startApp = async (canvas: HTMLCanvasElement) => {

	if (
		!localStorage.getItem('alreadyVisited') ||
		(navigator && !navigator.gpu) ||
		!('VideoEncoder' in window && 'VideoDecoder' in window) ||
		isViewportTooSmall()
	) {
		appState.palette.open = true;
		appState.palette.page = 'about';
		setupWorkerAndProject(canvas);
		return;
	}

	appState.palette.shrink = 'h-30';
	appState.palette.open = true;
	appState.palette.page = 'projects';
	appState.palette.lock = true;
	appState.progress.started = true;
	appState.progress.message = 'loading interface...';

	await setupWorkerAndProject(canvas);

	appState.palette.lock = false;
	appState.progress.percentage = 100;
	setTimeout(() => closePalette(), 300);

	setupTests();
};

const setupWorkerAndProject = async (canvas: HTMLCanvasElement) => {
	await workerManager.setup(canvas);
	const sen = await loadFont('/Sen.json');
	const montserrat = await loadFont('/Montserrat.json');
	appState.fonts = [sen, sen, montserrat];

	await setupProjectManager();
};

export const closePalette = () => {
	if (appState.palette.lock) return;
	appState.palette.open = false;
	appState.palette.shrink = '';
	appState.progress.started = false;
	appState.import.importStarted = false;
	appState.disableKeyboardShortcuts = false;
};


export const isViewportTooSmall = () => {
	const width  = window.innerWidth;
	const height = window.innerHeight;
	if (width < 800 || height < 650) return true;
	return false; 
}