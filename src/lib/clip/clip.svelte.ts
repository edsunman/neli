import type { Source } from '../source/source.svelte';

export class Clip {
	id = '';
	source: Source;

	track = 0;
	savedTrack = 0;
	start = $state(0);
	savedStart = 0;
	sourceOffset = 0;
	savedSourceOffset = 0;
	duration = $state(0);
	savedDuration = 0;
	joinLeft = false;
	joinRight = false;

	// 0 size x, 1 size y, 2 pos x, 3 pos y, 4 gain, 5 pan,
	// 6 font size, 7 line spacing, 8 justify (l,c,r), 9 red, 10 green, 11 blue
	params = $state([1, 1, 0, 0, 1, 0, 25, 1, 1, 1, 1, 1]);
	text = $state('text');

	deleted = false;
	invalid = false;
	hovered = false;
	resizeHover: 'none' | 'start' | 'end' = 'none';

	constructor(source: Source, track: number, start = 0, duration = 0, sourceOffset = 0) {
		this.id = Math.random().toString(16).slice(2);
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
