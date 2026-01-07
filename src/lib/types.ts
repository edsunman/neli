import type { Input, InputVideoTrack } from 'mediabunny';
import type { Source } from './source/source.svelte';

export type SourceType = 'text' | 'video' | 'audio' | 'test' | 'srt' | 'image';

export type TrackType = 'graphics' | 'video' | 'audio' | 'none';

export type Track = {
	height: number;
	top: number;
	lock: boolean;
	lockBottom: boolean;
	lockTop: boolean;
	type: TrackType;
};

export type FolderGroup = {
	type: TrackType;
	folders: { id: number; selected: boolean }[];
};

export type SrtEntry = {
	inPoint: number;
	outPoint: number;
	text: string;
};

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
	videoTrack?: InputVideoTrack;
	videoChunks?: EncodedVideoChunk[];
	videoConfig: VideoDecoderConfig;
	gap: number;
};

export type DragAndDropState = {
	clicked: boolean;
	active: boolean;
	x: number;
	y: number;
	showIcon: boolean;
	source: Source | null;
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
	  }
	| {
			type: 'srt';
			entries: number;
			duration: number;
	  }
	| {
			type: 'image';
			format: string;
			resolution: { width: number; height: number };
	  };

export type Font = {
	charCount: number;
	defaultChar: Character;
	lineHeight: number;
	characters: Characters;
	kernings: KerningMap;
};

export type Character = {
	id: number;
	index: number;
	char: string;
	width: number;
	height: number;
	xoffset: number;
	yofsset: number;
	xadvance: number;
	chnl: number;
	x: number;
	y: number;
	page: number;
	charIndex: number;
};

export type KerningMap = Map<number, Map<number, number>>;

export type Characters = { [x: number]: Character };
