import type { Decoder } from './worker/decoder';

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
	type: SourceType;
	decoder?: Decoder;
};

export type WorkerSource = { id: number; chunks: EncodedAudioChunk[]; config: VideoEncoderConfig };
