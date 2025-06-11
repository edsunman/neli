import type { Movie } from 'mp4box';

export class Source {
	id: string;
	name: string;
	duration: number;
	file: File;
	fileInfo: Movie;

	constructor(info: Movie, file: File) {
		this.id = Math.random().toString(16).slice(2);
		this.name = file.name;
		this.file = file;
		this.duration = info.videoTracks[0].nb_samples;
		this.fileInfo = info;
	}
}
