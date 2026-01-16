import type { SourceType, SrtEntry } from '$lib/types';
import type { AudioSampleSink, EncodedPacketSink } from 'mediabunny';

export class Source {
	id: string = '';
	type: SourceType = 'audio';
	name?: string;
	folderId = 0;
	preset = false;
	duration?: number;
	frameRate?: number;
	file?: File;
	thumbnail = $state('');
	sink: EncodedPacketSink | undefined;
	sampleSink: AudioSampleSink | undefined;
	audioConfig?: AudioEncoderConfig;
	audioWaveform?: Float32Array;
	srtEntries: SrtEntry[] = [];

	width = 1920;
	height = 1080;
}
