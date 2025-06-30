import type { Clip } from '$lib/clip/clip.svelte';
import { timelineState } from '$lib/state.svelte';
import { frameToCanvasPixel, secondsToTimecode } from './utils';

export const drawCanvas = (context: CanvasRenderingContext2D, width: number, height: number) => {
	context.fillStyle = '#18181b';
	context.fillRect(0, 0, width, height);

	drawRuler(context);

	// scrollbar
	if (timelineState.zoom > 0.9) {
		const padding = 0.05 / timelineState.zoom;
		const paddingInPixels = padding * width;
		context.fillStyle = '#3c3c44';
		context.beginPath();
		context.roundRect(
			(timelineState.offset + padding) * width,
			height - 40,
			width / timelineState.zoom - paddingInPixels * 2,
			10,
			8
		);
		context.fill();
	}

	// tracks

	const offsetInPixels = timelineState.width * timelineState.zoom * timelineState.offset;
	context.fillStyle = '#131315';
	context.beginPath();
	context.roundRect(
		Math.floor(-offsetInPixels),
		100,
		Math.floor(timelineState.width * timelineState.zoom),
		35,
		8
	);
	context.fill();

	context.beginPath();
	context.roundRect(
		Math.floor(-offsetInPixels),
		150,
		Math.floor(timelineState.width * timelineState.zoom),
		35,
		8
	);
	context.fill();

	context.beginPath();
	context.roundRect(
		Math.floor(-offsetInPixels),
		200,
		Math.floor(timelineState.width * timelineState.zoom),
		35,
		8
	);
	context.fill();

	// clips
	for (const clip of timelineState.clips) {
		const selected = timelineState.selectedClip?.id === clip.id;
		if (selected || clip.deleted) continue;
		drawClip(context, clip, width);
	}

	if (timelineState.selectedClip) drawClip(context, timelineState.selectedClip, width, true);

	// playhead
	const playheadPosition = frameToCanvasPixel(timelineState.currentFrame);
	context.fillStyle = 'white';
	context.fillRect(playheadPosition, 0, 2, height - 60);

	const radius = 3;
	context.beginPath();
	context.arc(playheadPosition - 4, 3, radius, 2.2, -1.4);
	context.arc(playheadPosition + 10 - 4, 3, radius, 4.6, 1.0);
	context.arc(playheadPosition + 5 - 4, 14, 1, 0.6, 2.6);
	context.arc(playheadPosition - 4, 3, radius, 2.2, -1.4);
	context.fill();
};

const drawRuler = (context: CanvasRenderingContext2D) => {
	const durationInSeconds = timelineState.duration / 30;
	const durationInMinutes = durationInSeconds / 60;
	const minuteInPixels = (timelineState.width / durationInMinutes) * timelineState.zoom;
	const offsetInPixels = timelineState.width * timelineState.zoom * timelineState.offset;

	const startFrame = Math.floor(timelineState.offset * timelineState.duration);
	const endFrame = Math.floor(
		(timelineState.offset + 1 / timelineState.zoom) * timelineState.duration
	);

	context.fillStyle = '#71717b';
	context.font = '12px sen';

	if (minuteInPixels <= 1000) {
		const numberOfMinutesToShow = Math.ceil((endFrame - startFrame) / 1800) + 1;
		let startMinute = Math.floor(startFrame / 1800);
		for (let i = 0; i < numberOfMinutesToShow; i++) {
			const position = Math.floor(minuteInPixels * startMinute - offsetInPixels);
			context.fillRect(position, 10, 1, 22);
			context.fillText(secondsToTimecode(startMinute * 60), position + 5, 25);
			startMinute++;
		}
	}

	if (minuteInPixels > 1000 && minuteInPixels <= 6000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30 / 6) + 1;
		let startSecond = Math.floor(startFrame / 30 / 10);

		for (let i = 0; i < numberOfSecondsToShow; i++) {
			const position = Math.floor((minuteInPixels / 6) * startSecond - offsetInPixels);
			context.fillRect(position, 10, 1, 22);
			context.fillText(secondsToTimecode(startSecond * 10), position + 5, 25);
			startSecond++;
		}
	}

	if (minuteInPixels > 6000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30) + 1;
		let startSecond = Math.floor(startFrame / 30);

		for (let i = 0; i < numberOfSecondsToShow; i++) {
			const position = Math.floor((minuteInPixels / 60) * startSecond - offsetInPixels);
			context.fillRect(position, 10, 1, 22);
			context.fillText(secondsToTimecode(startSecond), position + 5, 25);
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
			context.fillRect(position, 19, 1, 5);
			frame++;
		}
	}
};

const drawClip = (
	context: CanvasRenderingContext2D,
	clip: Clip,
	width: number,
	selected = false
) => {
	const startPercent = clip.start / timelineState.duration - timelineState.offset;
	const durationPercent = clip.duration / timelineState.duration;
	const endPercent = (clip.start + clip.duration) / timelineState.duration - timelineState.offset;

	const clipWidth = Math.round(durationPercent * width * timelineState.zoom);
	const clipStart = Math.round(startPercent * width * timelineState.zoom);
	const clipEnd = Math.round(endPercent * width * timelineState.zoom);

	if (clip.source.type === 'text') {
		context.fillStyle = '#57babb';
	} else {
		context.fillStyle = 'oklch(64.5% 0.246 16.439)';
	}

	if (clipWidth < 6) {
		context.fillRect(clipStart + 1, 50 + 50 * clip.track, 3, 35);
		return;
	}

	// base shape
	context.save();
	context.beginPath();
	context.roundRect(clipStart + 1, 50 + 50 * clip.track, clipWidth - 2, 35, 8);
	context.clip();
	context.fillRect(clipStart, 50 + 50 * clip.track, clipWidth + 2, 35);
	context.restore();

	if (selected || clip.hovered) {
		// handles
		context.save();
		context.beginPath();
		context.roundRect(
			clipStart + 4,
			50 + 50 * clip.track + 3,
			durationPercent * width * timelineState.zoom - 8,
			29,
			5
		);

		context.clip();
		context.fillStyle = '#131315';
		context.fillRect(clipStart, 50 + 50 * clip.track, 15, 35);
		context.fillRect(clipEnd - 15, 50 + 50 * clip.track, 15, 35);
		context.restore();

		if (clip.source.type === 'text') {
			context.fillStyle = '#57babb';
		} else {
			context.fillStyle = 'oklch(64.5% 0.246 16.439)';
		}

		context.fillRect(clipStart + 8, 50 + 50 * clip.track + 10, 3, 15);
		context.fillRect(clipEnd - 11, 50 + 50 * clip.track + 10, 3, 15);

		context.fillStyle = '#131315';

		if (selected) {
			context.beginPath();
			context.roundRect(
				Math.round(startPercent * width * timelineState.zoom + 5),
				50 + 50 * clip.track + 4,
				Math.ceil(durationPercent * width * timelineState.zoom - 10),
				27,
				5
			);
			context.strokeStyle = '#131315';
			context.lineWidth = 2;
			context.stroke();
		}
	}
};
