import type { Source } from '../source/source';

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

	params = $state([1, 1, 0, 0]);

	deleted = false;
	invalid = false;
	hovered = false;
	resizeHover: 'none' | 'start' | 'end' = 'none';

	constructor(source: Source, track: number, start = 0, duration = 0, sourceOffset = 0) {
		this.id = Math.random().toString(16).slice(2);
		this.track = source.type === 'text' ? 1 : 2;
		if (track) this.track = track;
		this.source = source;
		this.start = start;
		this.sourceOffset = sourceOffset;

		if (duration > 0) this.duration = duration;
	}
}
