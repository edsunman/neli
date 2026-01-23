import type { FileInfo, SourceType, SrtEntry } from '$lib/types';
import type { AudioSampleSink, EncodedPacketSink } from 'mediabunny';

export class Source {
	id: string = '';
	type: FileInfo['type'];
	name = $state('');
	folderId = 0;
	preset = false;
	info: FileInfo;
	file?: File;
	thumbnail = $state('');
	sink: EncodedPacketSink | undefined;
	sampleSink: AudioSampleSink | undefined;
	audioConfig?: AudioEncoderConfig;
	audioWaveform?: Float32Array;
	srtEntries: SrtEntry[] = [];
	// Frame numbers, out is the last frame of the selection
	selection = { in: 0, out: 0, currentFrame: 0 };

	constructor(type: SourceType, info: FileInfo) {
		this.type = type;
		this.info = info;
	}
}
