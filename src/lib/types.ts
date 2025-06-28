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
};
