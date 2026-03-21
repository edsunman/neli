import type { EncodedPacketSink, InputVideoTrack } from 'mediabunny';
import type { Source } from './source/source.svelte';

export type DragAndDropState = {
	currentCursor: { x: number; y: number };
	dragFrom: 'sources' | 'program';
	clicked: boolean;
	active: boolean;
	showIcon: boolean;
	source: Source | null;
};

export type ImportState = {
	importStarted: boolean;
	warningMessage: string;
	thumbnail: string;
	fileDetails: { name: string; type: string; info: FileInfo | null } | null;
};

export type PaletteState = {
	open: boolean;
	page: 'search' | 'export' | 'import' | 'about' | 'projects' | 'delete';
	shrink: string;
	lock: boolean;
};

export type PropertiesSection =
	| 'outputAudio'
	| 'project'
	| 'layout'
	| 'audio'
	| 'text'
	| 'source'
	| 'crop'
	| 'colour';

export type TrackType = 'graphics' | 'video' | 'audio' | 'none';
export type Track = {
	height: number;
	top: number;
	lock: boolean;
	lockBottom: boolean;
	lockTop: boolean;
	type: TrackType;
};

export type KeyframeTrack = {
	frames: number[];
	values: number[];
}

export type SrtEntry = {
	inPoint: number;
	outPoint: number;
	text: string;
};

export type SourceType = 'video' | 'audio' | 'srt' | 'image' | 'text' | 'test';

export type FileInfo =
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
			extention: string;
	  }
	| { type: 'text' }
	| { type: 'test' };

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

export type Command =
	| { action: 'addClip'; data: { clipId: string } }
	| { action: 'deleteClip'; data: { clipId: string } }
	| { action: 'addTrack'; data: { number: number; type: TrackType } }
	| { action: 'removeTrack'; data: { number: number; type: TrackType } }
	| {
			action: 'moveClip';
			data: {
				clipId: string;
				oldStart: number;
				newStart: number;
				oldTrack: number;
				newTrack: number;
			};
	  }
	| {
			action: 'trimClip';
			data: {
				clipId: string;
				oldStart: number;
				newStart: number;
				oldDuration: number;
				newDuration: number;
			};
	  }
	| {
			action: 'clipParam';
			data: { clipId: string; paramIndex: number[]; oldValue: number[]; newValue: number[] };
	  }
	| { action: 'deleteSource'; data: { sourceId: string } };

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
	useKeyframes:number[];
	keyframeTracks: Map<number, KeyframeTrack>
};

export type WorkerVideoSource = {
	id: string;
	videoTrack: InputVideoTrack;
	encodedPacketSink: EncodedPacketSink;
	videoConfig: VideoDecoderConfig;
	gap: number;
	height: number;
	width: number;
	frameRate: number;
};
