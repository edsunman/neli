import { resizeCanvas } from '$lib/program/actions';
import { appState } from '$lib/state.svelte';

export const changeProjectResolution = (width: number, height: number) => {
	appState.project.resolution.height = height;
	appState.project.resolution.width = width;
	resizeCanvas(width, height);
};
