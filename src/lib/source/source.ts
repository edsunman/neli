import type { Movie } from 'mp4box';

type SourceType = 'text' | 'video' | 'audio';

export class Source {
	id: string;
	type: SourceType;
	name?: string;
	duration?: number;
	file?: File;
	fileInfo?: Movie;

	constructor(type: SourceType, info?: Movie, file?: File) {
		this.id = Math.random().toString(16).slice(2);
		this.type = type;

		if (type === 'text') {
			this.name = 'Text';
		}
		if (file) {
			this.name = file.name;
			this.file = file;
		}
		if (info) {
			this.duration = info.videoTracks[0].nb_samples;
			this.fileInfo = info;
		}
	}
}
