import type { Source } from '$lib/source/source.svelte';
import { appState, programState, timelineState } from '$lib/state.svelte';
import {
	resizeWorkerCanvas,
	seekWorkerSource,
	showSource,
	showTimeline
} from '$lib/worker/actions.svelte';
import { programTimelinePixelToFrame } from './utils';

export const showSourceInProgram = (source: Source) => {
	if (appState.selectedSource && appState.selectedSource.id !== source.id) {
		appState.selectedSource.selection.currentFrame = programState.currentFrame;
	}
	appState.selectedSource = source;

	if (source.info.type !== 'video') return;
	const info = source.info;
	timelineState.showPlayhead = false;
	timelineState.invalidate = true;
	programState.canvasHeight = info.resolution.height;
	programState.canvasWidth = info.resolution.width;
	programState.duration = Math.floor(info.duration * info.frameRate) + 1;
	programState.currentFrame = source.selection.currentFrame;
	programState.invalidateTimeline = true;
	showSource(appState.selectedSource.id, programState.currentFrame);
};

export const showTimelineInProgram = () => {
	if (!appState.selectedSource) return;
	appState.selectedSource.selection.currentFrame = programState.currentFrame;
	appState.selectedSource = null;
	timelineState.showPlayhead = true;
	timelineState.invalidate = true;
	programState.canvasHeight = appState.project.resolution.height;
	programState.canvasWidth = appState.project.resolution.width;
	showTimeline();
};

export const setCurrentFrame = (frame: number) => {
	if (frame < 0) frame = 0;
	if (frame > programState.duration - 1) frame = programState.duration - 1;
	seekWorkerSource(frame);
	programState.currentFrame = frame;
	programState.invalidateTimeline = true;
};

export const setCurrentFrameFromOffset = (canvasOffset: number) => {
	const frame = programTimelinePixelToFrame(canvasOffset);
	setCurrentFrame(frame);
};

export const resizeCanvas = (width: number, height: number) => {
	programState.canvasHeight = height;
	programState.canvasWidth = width;
	// update workerresizeCanvas(width, height);
	resizeWorkerCanvas(width, height);
};

export const setInPoint = () => {
	if (!appState.selectedSource) return;
	const selection = appState.selectedSource.selection;
	selection.in = programState.currentFrame;

	if (selection.in > selection.out) selection.out = selection.in + 5;
	if (selection.in > selection.out - 5) selection.in = selection.out - 5;

	if (selection.in < 0) {
		selection.in = 0;
		if (selection.out < 5) selection.out = 5;
	}

	programState.invalidateTimeline = true;
};

export const setOutPoint = () => {
	if (!appState.selectedSource) return;
	const selection = appState.selectedSource.selection;
	selection.out = programState.currentFrame;

	if (selection.out < selection.in) selection.in = selection.out - 5;
	if (selection.out < selection.in + 5) selection.out = selection.in + 5;

	const lastFrame = programState.duration;
	if (selection.out > lastFrame) {
		selection.out = lastFrame;
		if (selection.in > lastFrame - 5) selection.in = lastFrame - 5;
	}
	console.log('set out ', selection.out);
	programState.invalidateTimeline = true;
};
