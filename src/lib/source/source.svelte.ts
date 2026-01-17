import type { FileInfo, SourceType, SrtEntry } from '$lib/types';
import type { AudioSampleSink, EncodedPacketSink } from 'mediabunny';

export class Source {
	id: string = '';
	type: FileInfo['type'];
	name?: string;
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

	constructor(type: SourceType, info: FileInfo) {
		this.type = type;
		this.info = info;
	}
}
