import { timelineState } from '$lib/state.svelte';
import { frameToCanvasOffset } from './utils';

export const drawCanvas = (context: CanvasRenderingContext2D, width: number, height: number) => {
	context.fillStyle = '#18181b';
	context.fillRect(0, 0, width, height);

	const durationInSeconds = timelineState.duration / 30;
	const durationInMinutes = durationInSeconds / 60;
	const minuteInPixels = (timelineState.width / durationInMinutes) * timelineState.zoom;
	const offsetInPixels = timelineState.width * timelineState.zoom * timelineState.offset;
	//console.log(offsetInPixels);

	context.fillStyle = '#777';
	context.font = '12px sen';

	// minutes
	for (let i = 0; i < durationInMinutes; i++) {
		const position = Math.floor(minuteInPixels * i - offsetInPixels);
		context.fillRect(position, 0, 1, 20);
		context.fillText(`0${i.toString()}:00`, position + 5, 12);
	}

	// 30 secs
	/* 	for (let i = 0; i < durationInMinutes; i++) {
		const position = Math.floor(minuteInPixels * i + minuteInPixels / 2);
		context.fillRect(position, 0, 1, 20);
		//context.fillText(i.toString(), position + 5, 10);
	} */

	for (const clip of timelineState.clips) {
		const selected = timelineState.selectedClip?.id === clip.id;
		if (selected) {
			context.fillStyle = 'blue';
		} else {
			context.fillStyle = 'green';
		}
		if (clip.invalid) {
			context.fillStyle = 'red';
		}

		const startPercent = clip.start / timelineState.duration - timelineState.offset;
		const durationPercent = clip.duration / timelineState.duration;
		const endPercent = (clip.start + clip.duration) / timelineState.duration - timelineState.offset;

		// base shape
		context.fillRect(
			Math.floor(startPercent * width * timelineState.zoom), //+ offset,
			40,
			Math.floor(durationPercent * width * timelineState.zoom), //+ lengthOffset,
			40
		);

		if (!selected && !clip.hovered) continue;

		// handles
		context.fillStyle = 'white';
		context.fillRect(Math.floor(startPercent * width * timelineState.zoom), 40, 10, 40);
		context.fillRect(Math.floor(endPercent * width * timelineState.zoom) - 10, 40, 10, 40);
	}

	const playheadPosition = frameToCanvasOffset(timelineState.currentFrame);
	context.fillStyle = 'white';
	context.fillRect(playheadPosition, 0, 2, height);
};
