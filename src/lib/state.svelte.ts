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
	dragStart = 0;
	hoverClipId = '';
	invalidate = false;
}

export const timelineState = new TimelineState();

export class Clip {
	id: string;
	videoClip: VideoClip;
	source: Source;
	layer = 0;
	start = 0;
	sourceOffset = 0;
	duration: number = $state(0);
	hovered: boolean = false;
	resizeHover: 'none' | 'start' | 'end' = 'none';
	constructor(videoClip: VideoClip, source: Source) {
		this.id = Math.random().toString(16).slice(2);
		this.videoClip = videoClip;
		this.source = source;
		this.layer = 0;
		this.start = 0;
		this.duration = source.videoSource.duration?.frames ?? 0;
	}
}

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
