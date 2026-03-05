import type { FileInfo, SourceType, SrtEntry } from '$lib/types';
import type { AudioSampleSink, EncodedPacketSink } from 'mediabunny';

export class Source {
	id: string;
	type: FileInfo['type'];
	name = $state('');
	info: FileInfo;
	file?: File;
	handle?: FileSystemHandle;
	folderId = 0;
	unlinked = $state(false);
	thumbnail = $state('');

	sink: EncodedPacketSink | undefined;
	sampleSink: AudioSampleSink | undefined;
	audioConfig?: AudioEncoderConfig;
	audioWaveform?: Float32Array;

	srtEntries: SrtEntry[] = [];
	// Frame numbers, out is the last frame of the selection
	selection = { in: 0, out: 0, currentFrame: 0 };

	constructor(type: SourceType, info: FileInfo) {
		this.id = crypto.randomUUID();
		this.type = type;
		this.info = info;
	}
}
