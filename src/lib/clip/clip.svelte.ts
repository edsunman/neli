import type { Source } from '../source/source';

export class Clip {
	id = '';
	source: Source;

	track = 0;
	start = 0;
	savedStart = 0;
	sourceOffset = 0;
	savedSourceOffset = 0;
	duration = 0;
	savedDuration = 0;

	scaleX = $state(0.5);
	scaleY = $state(0.5);

	deleted = false;
	invalid = false;
	hovered = false;
	resizeHover: 'none' | 'start' | 'end' = 'none';

	constructor(
		/* videoClip: VideoClip,  */ source: Source,
		track: number,
		start = 0,
		duration = 0,
		sourceOffset = 0
	) {
		this.id = Math.random().toString(16).slice(2);
		this.track = track ? track : Math.floor(Math.random() * 3 + 1);

		this.source = source;
		this.start = start;
		this.sourceOffset = sourceOffset;

		if (duration > 0) this.duration = duration;
	}
}
