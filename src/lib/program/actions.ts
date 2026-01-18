import { programState, timelineState } from '$lib/state.svelte';
import { resizeWorkerCanvas } from '$lib/worker/actions.svelte';
import { programTimelinePixelToFrame } from './utils';

export const showSourceInProgram = () => {
	timelineState.showPlayhead = false;
	timelineState.invalidate = true;
};

export const hideSourceInProgram = () => {
	timelineState.showPlayhead = true;
	timelineState.invalidate = true;
};

export const setCurrentFrame = (frame: number) => {
	if (frame < 0) frame = 0;
	if (frame > programState.duration - 1) frame = programState.duration - 1;
	//seekWorker(frame);
	programState.currentFrame = frame;
	programState.invalidateTimeline = true;
};

export const setCurrentFrameFromOffset = (canvasOffset: number) => {
	// if (timelineState.playing) pause();
	const frame = programTimelinePixelToFrame(canvasOffset);
	setCurrentFrame(frame);
};

export const resizeCanvas = (width: number, height: number) => {
	programState.canvasHeight = height;
	programState.canvasWidth = width;
	// update workerresizeCanvas(width, height);
	resizeWorkerCanvas(width, height);
};
