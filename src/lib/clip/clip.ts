import type { Source } from '$lib/state.svelte';
import type { VideoClip } from '@diffusionstudio/core';

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

	constructor(videoClip: VideoClip, source: Source, start = 0, duration = 0, sourceOffset = 0) {
		this.id = Math.random().toString(16).slice(2);
		this.videoClip = videoClip;
		this.source = source;
		this.start = start;
		this.sourceOffset = sourceOffset;

		if (duration > 0) {
			this.duration = duration;
		} else {
			this.duration = source.videoSource.duration?.frames ?? 0;
		}
	}
}
