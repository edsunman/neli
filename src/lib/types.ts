//import type { VDecoder } from './worker/decoder';

export type SourceType = 'text' | 'video' | 'audio' | 'test';

export type WorkerClip = {
	id: string;
	sourceId: string;
	start: number;
	duration: number;
	sourceOffset: number;
	track: number;
	params: number[];
	text: string;
	deleted: boolean;
	type: SourceType;
};

export type WorkerSource = {
	id: string;
	videoChunks: EncodedVideoChunk[];
	audioChunks: EncodedAudioChunk[];
	audioConfig: AudioEncoderConfig;
	videoConfig: VideoEncoderConfig;
};
