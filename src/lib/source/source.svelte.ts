import type { SourceType } from '$lib/types';
import type { Movie } from 'mp4box';

export class Source {
	id: string;
	type: SourceType;
	name?: string;
	duration?: number;
	frameRate?: number;
	file?: File;
	fileInfo?: Movie;
	thumbnail = $state('');
	audioChunks: EncodedAudioChunk[] = [];
	audioConfig?: AudioEncoderConfig;
	audioWaveform?: Float32Array;

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
			const trackInfo = info.videoTracks[0];
			this.frameRate = trackInfo.nb_samples / (trackInfo.samples_duration / trackInfo.timescale);
			const frameCount = trackInfo.nb_samples;

			// limit to 2 mins
			const maxSampleCount = this.frameRate * 120;
			this.duration = frameCount > maxSampleCount ? maxSampleCount : frameCount;
			this.fileInfo = info;
		}
		if (audioChunks && audioConfig) {
			this.audioChunks = audioChunks;
			this.audioConfig = audioConfig;
		}
	}
}
