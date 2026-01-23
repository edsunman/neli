import { pauseAudio, runSourceAudio } from '$lib/audio/actions';
import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source.svelte';
import { appState, historyManager, programState, timelineState } from '$lib/state.svelte';
import { pause } from '$lib/timeline/actions';
import {
	pauseWorker,
	playWorker,
	resizeWorkerCanvas,
	seekWorker,
	showAudioSource,
	showSource,
	showTimeline,
	updateWorkerClip
} from '$lib/worker/actions.svelte';
import { programTimelinePixelToFrame, scaleToFit } from './utils';

export const playProgram = () => {
	if (appState.selectedSource?.type === 'audio') startProgramPlayLoop();
	if (appState.selectedSource?.type == 'video') playWorker(programState.currentFrame);
};

export const startProgramPlayLoop = () => {
	programState.playing = true;

	let fps = 30;
	if (appState.selectedSource?.info.type === 'video') {
		fps = appState.selectedSource?.info.frameRate;
	}

	const msPerFrame = 1000 / fps;
	const epsilon = 1; // Tolerance for smoother playback
	let accumulator = 0;
	let lastTime = 0;
	let firstTimestamp = 0;

	const loop = (timestamp: number) => {
		if (!programState.playing) return;

		if (lastTime === 0) lastTime = timestamp;
		if (firstTimestamp === 0) firstTimestamp = timestamp;

		if (programState.currentFrame >= programState.duration - 1) {
			programState.currentFrame = programState.duration - 1;
			pauseProgram();
		}

		const deltaTime = timestamp - lastTime;
		lastTime = timestamp;
		accumulator += deltaTime;

		while (accumulator >= msPerFrame - epsilon) {
			programState.currentFrame++;
			accumulator -= msPerFrame;
			programState.invalidateTimeline = true;
		}

		const elapsedTimeMs = timestamp - firstTimestamp;
		runSourceAudio(programState.currentFrame, elapsedTimeMs);

		if (programState.playing) requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
};

export const pauseProgram = () => {
	if (!programState.playing) return;
	programState.playing = false;
	if (appState.selectedSource?.type == 'video') pauseWorker(programState.currentFrame);
	pauseAudio();
};

export const showSourceInProgram = (source: Source) => {
	if (timelineState.playing) pause();
	if (source.info.type !== 'video' && source.info.type !== 'image' && source.info.type !== 'audio')
		return;

	if (appState.selectedSource && appState.selectedSource.id !== source.id) {
		appState.selectedSource.selection.currentFrame = programState.currentFrame;
	}
	appState.selectedSource = source;
	const info = source.info;

	timelineState.showPlayhead = false;
	timelineState.invalidate = true;

	if (info.type === 'image') {
		const { width, height } = scaleToFit(1920, 1080, info.resolution.width, info.resolution.height);
		programState.canvasHeight = height;
		programState.canvasWidth = width;
		showSource(appState.selectedSource.id, 0, true, height, width);
		return;
	}

	programState.currentFrame = source.selection.currentFrame;
	programState.invalidateTimeline = true;

	if (info.type === 'audio') {
		programState.duration = Math.round(info.duration * 30);
		showAudioSource();
		return;
	}

	if (info.type === 'video') {
		programState.duration = Math.round(info.duration * info.frameRate);
		programState.canvasHeight = info.resolution.height;
		programState.canvasWidth = info.resolution.width;
	}

	showSource(appState.selectedSource.id, programState.currentFrame);
};

export const showTimelineInProgram = () => {
	if (!appState.selectedSource) return;
	if (programState.playing) pauseProgram();
	appState.selectedSource.selection.currentFrame = programState.currentFrame;
	appState.selectedSource = null;
	appState.propertiesSection = 'outputAudio';
	timelineState.showPlayhead = true;
	timelineState.invalidate = true;
	programState.canvasHeight = appState.project.resolution.height;
	programState.canvasWidth = appState.project.resolution.width;
	showTimeline();
};

export const setCurrentFrame = (frame: number) => {
	if (frame < 0) frame = 0;
	if (frame > programState.duration) frame = programState.duration;
	if (appState.selectedSource?.type === 'video') seekWorker(frame);
	programState.currentFrame = frame;
	programState.invalidateTimeline = true;
};

export const setCurrentFrameFromOffset = (canvasOffset: number) => {
	if (programState.playing) pauseProgram();
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
	programState.invalidateTimeline = true;
};

export const resetInOutPoints = () => {
	if (!appState.selectedSource) return;
	const selection = appState.selectedSource.selection;
	const info = appState.selectedSource.info;

	selection.in = 0;
	if (info.type === 'video') selection.out = Math.round(info.duration * info.frameRate);
	if (info.type === 'audio') selection.out = Math.round(info.duration * 30);
	programState.invalidateTimeline = true;
};

export const transformClip = (
	clip: Clip,
	scaleX: number,
	scaleY: number,
	positionX: number,
	positionY: number
) => {
	historyManager.newCommand({
		action: 'clipParam',
		data: {
			clipId: clip.id,
			paramIndex: [0, 1, 2, 3],
			oldValue: [clip.params[0], clip.params[1], clip.params[2], clip.params[3]],
			newValue: [scaleX, scaleY, positionX, positionY]
		}
	});
	clip.params[0] = scaleX;
	clip.params[1] = scaleY;
	clip.params[2] = positionX;
	clip.params[3] = positionY;
	updateWorkerClip(timelineState.selectedClip);
};
