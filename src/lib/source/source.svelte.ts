import type { SourceType, SrtEntry } from '$lib/types';

export class Source {
	id: string;
	type: SourceType;
	name?: string;
	duration?: number;
	frameRate?: number;
	file?: File;
	thumbnail = $state('');
	audioChunks: EncodedAudioChunk[] = [];
	audioConfig?: AudioEncoderConfig;
	audioWaveform?: Float32Array;
	srtEntries: SrtEntry[] = [];

	width = 1920;
	height = 1080;

	constructor(type: SourceType, file?: File) {
		this.id = Math.random().toString(16).slice(2);
		this.type = type;

		if (type === 'text') this.name = 'Text';
		if (type === 'test') this.name = 'Test card';

		if (file) {
			const lastDotIndex = file.name.lastIndexOf('.');
			const nameNoExt = lastDotIndex === -1 ? file.name : file.name.slice(0, lastDotIndex);
			this.name = nameNoExt;
			this.file = file;
		}

		if (type === 'audio') {
			this.frameRate = 30;
		}
	}
}
