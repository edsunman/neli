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
	selectedClip = $state.raw<Clip | null>(null);

	zoom = 1;
	offset = 0; // percentage, 0 to 1
	dragOffset = 0; // pixels
	dragStart = 0; // pixels
	hoverClipId = '';
	invalidate = false;
}

export const timelineState = new TimelineState();

export class Clip {
	id = '';
	videoClip: VideoClip;
	source: Source;

	start = 0;
	savedStart = 0;
	sourceOffset = 0;
	savedSourceOffset = 0;
	duration = 0;
	savedDuration = 0;

	invalid = false;
	hovered = false;
	resizeHover: 'none' | 'start' | 'end' = 'none';

	constructor(videoClip: VideoClip, source: Source) {
		this.id = Math.random().toString(16).slice(2);
		this.videoClip = videoClip;
		this.source = source;
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
