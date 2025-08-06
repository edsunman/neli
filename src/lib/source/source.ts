import type { SourceType } from '$lib/types';
import type { Movie } from 'mp4box';

export class Source {
	id: string;
	type: SourceType;
	name?: string;
	duration?: number;
	file?: File;
	fileInfo?: Movie;
	audioChunks: EncodedAudioChunk[] = [];
	audioConfig?: AudioEncoderConfig;

	width = 1920;
	height = 1080;

	constructor(
		type: SourceType,
		info?: Movie,
		file?: File,
		audioChunks?: EncodedAudioChunk[],
		audioConfig?: AudioEncoderConfig
	) {
		this.id = Math.random().toString(16).slice(2);
		this.type = type;

		if (type === 'text') this.name = 'Text';
		if (type === 'test') this.name = 'Test card';

		if (file) {
			this.name = file.name;
			this.file = file;
		}
		if (info) {
			this.duration = info.videoTracks[0].nb_samples;
			this.fileInfo = info;
		}
		if (audioChunks && audioConfig) {
			this.audioChunks = audioChunks;
			this.audioConfig = audioConfig;
		}
	}
}
