import { resizeCanvas, showTimelineInProgram } from '$lib/program/actions';
import { appState } from '$lib/state.svelte';
import { pause } from '$lib/timeline/actions';

export const changeProjectResolution = (width: number, height: number) => {
	pause();
	showTimelineInProgram();
	appState.project.resolution.height = height;
	appState.project.resolution.width = width;
	resizeCanvas(width, height);
};
