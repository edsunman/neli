import type { Composition, VideoSource } from '@diffusionstudio/core';
import type { Clip } from './clip/clip';
import { HistoryCommands } from './history/history';

class AppState {
	composition: Composition | null = null;
	sources = $state<Source[]>([]);
	showPalette = $state(false);
}

export const appState = new AppState();

class TimelineState {
	clips = $state<Clip[]>([]);
	duration = $state(9000); // frames
	currentFrame = $state(0);
	playing = $state(false);
	width = $state(0); // pixels
	selectedClip = $state.raw<Clip | null>(null);

	zoom = 0.9;
	offset = -0.055; // percentage, 0...1
	offsetStart = 0; // percentage, 0...1
	dragOffset = 0; // pixels
	dragStart = 0; // pixels
	hoverClipId = '';
	invalidate = false;
}

export const timelineState = new TimelineState();

export class Source {
	id: string;
	duration: number;
	videoSource: VideoSource;
	constructor(videoSource: VideoSource) {
		this.id = Math.random().toString(16).slice(2);
		this.videoSource = videoSource;
		this.duration = videoSource.duration?.frames ?? 0;
	}
}

export const appHistory = new HistoryCommands();
