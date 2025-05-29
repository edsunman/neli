import { timelineState } from '$lib/state.svelte';
import { frameToCanvasOffset } from './utils';

export const drawCanvas = (context: CanvasRenderingContext2D, width: number, height: number) => {
	context.fillStyle = '#18181b';
	context.fillRect(0, 0, width, height);
	for (const clip of timelineState.clips) {
		const selected = timelineState.selectedClipId === clip.id;
		if (selected) {
			context.fillStyle = 'blue';
		} else {
			context.fillStyle = clip.hovered ? 'red' : 'green';
		}

		const startPercent = clip.start / timelineState.duration;
		const durationPercent = clip.duration / timelineState.duration;
		const endPercent = (clip.start + clip.duration) / timelineState.duration;
		let offset = 0;
		let lengthOffset = 0;
		if (selected && clip.resizeHover === 'end') {
			lengthOffset = timelineState.dragOffset;
		} else if (selected && clip.resizeHover === 'start') {
			offset = timelineState.dragOffset;
			lengthOffset = -timelineState.dragOffset;
		} else if (selected) {
			offset = timelineState.dragOffset;
		}

		// base shape
		context.fillRect(
			Math.floor(startPercent * width) + offset,
			40,
			Math.floor(durationPercent * width) + lengthOffset,
			40
		);

		if (!selected && !clip.hovered) continue;

		// handles
		context.fillStyle = 'white';
		context.fillRect(Math.floor(startPercent * width) + offset, 40, 10, 40);
		context.fillRect(Math.floor(endPercent * width) + offset + lengthOffset - 10, 40, 10, 40);
	}

	const playheadPosition = frameToCanvasOffset(
		timelineState.currentFrame,
		timelineState.duration,
		width
	);
	context.fillStyle = 'white';
	context.fillRect(playheadPosition - 1, 0, 2, height);
};
