//import type { VDecoder } from './worker/decoder';

export type SourceType = 'text' | 'video' | 'audio' | 'test';

export type WorkerClip = {
	id: string;
	sourceId: string;
	start: number;
	duration: number;
	sourceOffset: number;
	sourceHeight: number;
	sourceWidth: number;
	track: number;
	params: number[];
	text: string;
	deleted: boolean;
	type: SourceType;
};

export type WorkerSource = {
	id: string;
	videoChunks: EncodedVideoChunk[];
	videoConfig: VideoDecoderConfig;
	gap: number;
};

export type FileInfo =
	| {
			error: string;
	  }
	| {
			type: 'video';
			codec: string;
			resolution: { width: number; height: number };
			frameRate: number;
			duration: number;
	  }
	| {
			type: 'audio';
			codec: string;
			sampleRate: number;
			channelCount: number;
			duration: number;
	  };
