import type { Composition, VideoClip, VideoSource } from '@diffusionstudio/core';

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
	width = $state(0);
	selectedClipId = $state('');

	dragOffset = 0;
	hoverClipId = '';
	invalidate = false;
}

export const timelineState = new TimelineState();

export class Clip {
	id: string;
	videoClip: VideoClip;
	sourceId: string;
	layer: number = 0;
	start: number = 0;
	duration: number;
	hovered: boolean = false;
	resizeHover: 'none' | 'start' | 'end' = 'none';
	constructor(videoClip: VideoClip, sourceId: string, duration: number) {
		this.id = Math.random().toString(16).slice(2);
		this.videoClip = videoClip;
		this.sourceId = sourceId;
		this.layer = 0;
		this.start = 0;
		this.duration = $state(duration);
	}
}

export class Source {
	id: string;
	videoSource: VideoSource;
	constructor(videoSource: VideoSource) {
		this.id = Math.random().toString(16).slice(2);
		this.videoSource = videoSource;
	}
}
