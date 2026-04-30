import type { KeyframeTrack } from '$lib/types';
import type { Source } from '../source/source.svelte';

export class Clip {
	id = '';
	source: Source;

	track = 0;
	savedTrack = 0;
	start = 0;
	savedStart = 0;
	sourceOffset = 0;
	savedSourceOffset = 0;
	duration = 0;
	savedDuration = 0;
	joinLeft = false;
	joinRight = false;

	params = $state([
		// 0 size x, 1 size y, 2 pos x, 3 pos y, 4 gain, 5 pan,
		1, 1, 0, 0, 1, 0,
		// 6 font size, 7 line spacing, 8 justify (l,c,r), 9 red, 10 green, 11 blue
		25, 1, 1, 1, 1, 1,
		// 12 crop t, 13 crop r, 14 crop b, 15 crop l, 16 rounded corners, 17 rotation
		0, 0, 0, 0, 0, 0,
		// 18 opacity, 19 exposure, 20 contrast, 21 saturation
		1, 0, 1, 1,
		// 22 write on, 23 font
		1, 1
	]);
	text = $state('text');

	keyframeTracks = new Map<number, KeyframeTrack>();
	keyframeTracksActive = $state<number[]>([]);
	keyframesOnThisFrame = $state<number[]>([]);

	deleted = false;
	invalid = false;
	hovered = false;
	temp = $state(false);
	resizeHover: 'none' | 'start' | 'end' = 'none';

	constructor(source: Source, track: number, start = 0, duration = 0, sourceOffset = 0) {
		this.id = crypto.randomUUID();
		this.track = track;
		this.savedTrack = track;
		this.source = source;
		this.start = start;
		this.savedStart = start;
		this.sourceOffset = sourceOffset;
		this.duration = duration;
		this.savedDuration = duration;
	}
}
