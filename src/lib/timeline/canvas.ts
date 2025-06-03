import { timelineState } from '$lib/state.svelte';
import { frameToCanvasPixel, secondsToTimecode } from './utils';

export const drawCanvas = (context: CanvasRenderingContext2D, width: number, height: number) => {
	context.fillStyle = '#18181b';
	context.fillRect(0, 0, width, height);

	const durationInSeconds = timelineState.duration / 30;
	const durationInMinutes = durationInSeconds / 60;
	const minuteInPixels = (timelineState.width / durationInMinutes) * timelineState.zoom;
	const offsetInPixels = timelineState.width * timelineState.zoom * timelineState.offset;

	const startFrame = Math.floor(timelineState.offset * timelineState.duration);
	const endFrame = Math.floor(
		(timelineState.offset + 1 / timelineState.zoom) * timelineState.duration
	);

	context.fillStyle = '#52525c';
	context.font = '12px sen';

	if (minuteInPixels <= 1000) {
		const numberOfMinutesToShow = Math.ceil((endFrame - startFrame) / 1800) + 1;
		let startMinute = Math.floor(startFrame / 1800);
		for (let i = 0; i < numberOfMinutesToShow; i++) {
			const position = Math.floor(minuteInPixels * startMinute - offsetInPixels);
			context.fillRect(position, 0, 1, 22);
			context.fillText(secondsToTimecode(startMinute * 60), position + 5, 15);
			startMinute++;
		}
	}

	if (minuteInPixels > 1000 && minuteInPixels <= 6000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30 / 6) + 1;
		let startSecond = Math.floor(startFrame / 30 / 10);

		for (let i = 0; i < numberOfSecondsToShow; i++) {
			const position = Math.floor((minuteInPixels / 6) * startSecond - offsetInPixels);
			context.fillRect(position, 0, 1, 22);
			context.fillText(secondsToTimecode(startSecond * 10), position + 5, 15);
			startSecond++;
		}
	}

	if (minuteInPixels > 6000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30) + 1;
		let startSecond = Math.floor(startFrame / 30);

		for (let i = 0; i < numberOfSecondsToShow; i++) {
			const position = Math.floor((minuteInPixels / 60) * startSecond - offsetInPixels);
			context.fillRect(position, 0, 1, 22);

			context.fillText(secondsToTimecode(startSecond), position + 5, 15);
			startSecond++;
		}
	}

	if (minuteInPixels > 40000) {
		const numberOfFramesToShow = Math.ceil(endFrame - startFrame) + 1;
		let frame = startFrame > 0 ? startFrame : 0;
		for (let i = 0; i < numberOfFramesToShow; i++) {
			if (minuteInPixels < 70000 && (frame - 1) % 30 === 0) {
				frame++;
				continue;
			}
			const position = Math.floor((minuteInPixels / 60 / 30) * frame - offsetInPixels);
			context.fillRect(position, 9, 1, 5);
			frame++;
		}
	}

	// scrollbar
	if (timelineState.zoom > 0.9) {
		const padding = 0.05 / timelineState.zoom;
		const paddingInPixels = padding * width;
		context.fillStyle = '#3f3f47';
		context.fillRect(
			(timelineState.offset + padding) * width,
			height - 40,
			width / timelineState.zoom - paddingInPixels * 2,
			20
		);
	}

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

	const playheadPosition = frameToCanvasPixel(timelineState.currentFrame);
	context.fillStyle = 'white';
	context.fillRect(playheadPosition, 0, 2, height - 80);
};
