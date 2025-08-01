import type { VDecoder } from './worker/decoder';

export type SourceType = 'text' | 'video' | 'audio';

export type WorkerClip = {
	id: string;
	sourceId: string;
	start: number;
	duration: number;
	sourceOffset: number;
	scaleX: number;
	scaleY: number;
	positionX: number;
	positionY: number;
	deleted: boolean;
	type: SourceType;
	decoder?: VDecoder | null;
};

export type WorkerSource = {
	id: string;
	videoChunks: EncodedVideoChunk[];
	audioChunks: EncodedAudioChunk[];
	audioConfig: AudioEncoderConfig;
	videoConfig: VideoEncoderConfig;
};
