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
	deleted: boolean;
	type: SourceType;
	decoder?: Decoder | null;
};

export type WorkerSource = { id: string; chunks: EncodedAudioChunk[]; config: VideoEncoderConfig };
