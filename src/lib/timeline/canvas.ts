import type { Clip } from '$lib/clip/clip.svelte';
import { timelineState } from '$lib/state.svelte';
import { frameToCanvasPixel, secondsToTimecode } from './utils';

const GREEN = '#50cfaf';
const PURPLE = '#8b4fcf';
const BLUE = '#419fda';

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

	context.beginPath();
	context.roundRect(
		Math.floor(-offsetInPixels),
		250,
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
	context.fillRect(playheadPosition, 20, 2, height - 80);

	const radius = 3;
	context.beginPath();
	context.arc(playheadPosition - 4, 23, radius, 2.2, -1.4);
	context.arc(playheadPosition + 10 - 4, 23, radius, 4.6, 1.0);
	context.arc(playheadPosition + 5 - 4, 34, 1, 0.6, 2.6);
	context.arc(playheadPosition - 4, 23, radius, 2.2, -1.4);
	context.fill();
};

const drawRuler = (context: CanvasRenderingContext2D) => {
	const rulerPosition = 20;
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
			context.fillRect(position, rulerPosition + 10, 1, 22);
			context.fillText(secondsToTimecode(startMinute * 60), position + 5, rulerPosition + 25);
			startMinute++;
		}
	}

	if (minuteInPixels > 1000 && minuteInPixels <= 6000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30 / 6) + 1;
		let startSecond = Math.floor(startFrame / 30 / 10);

		for (let i = 0; i < numberOfSecondsToShow; i++) {
			const position = Math.floor((minuteInPixels / 6) * startSecond - offsetInPixels);
			context.fillRect(position, rulerPosition + 10, 1, 22);
			context.fillText(secondsToTimecode(startSecond * 10), position + 5, rulerPosition + 25);
			startSecond++;
		}
	}

	if (minuteInPixels > 6000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30) + 1;
		let startSecond = Math.floor(startFrame / 30);

		for (let i = 0; i < numberOfSecondsToShow; i++) {
			const position = Math.floor((minuteInPixels / 60) * startSecond - offsetInPixels);
			context.fillRect(position, rulerPosition + 10, 1, 22);
			context.fillText(secondsToTimecode(startSecond), position + 5, rulerPosition + 25);
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
			context.fillRect(position, rulerPosition + 19, 1, 5);
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
	let clipColor = GREEN;
	if (clip.source.type === 'text') {
		clipColor = PURPLE;
	} else if (clip.source.type === 'audio') {
		clipColor = BLUE;
	}

	context.fillStyle = clipColor;

	const gap = 3;
	const trackTop = 50 + 50 * clip.track;
	const startPercent = clip.start / timelineState.duration - timelineState.offset;
	const endPercent = (clip.start + clip.duration) / timelineState.duration - timelineState.offset;

	const clipFullStart = Math.round(startPercent * width * timelineState.zoom);
	const clipFullEnd = Math.round(endPercent * width * timelineState.zoom);

	const clipStart = clipFullStart + 1;
	const clipWidth = clipFullEnd - clipFullStart - gap;
	const clipEnd = clipFullEnd - gap;

	const maskStart = clip.joinLeft ? clipStart - 20 : clipStart;
	let maskWidth = clipWidth;
	if (clip.joinLeft || clip.joinRight) maskWidth = clipWidth + 20;
	if (clip.joinLeft && clip.joinRight) maskWidth = clipWidth + 40;

	if (clipWidth < 6) {
		context.fillRect(clipStart + 1, 50 + 50 * clip.track, 3, 35);
		return;
	}

	// base shape
	context.save();
	context.beginPath();
	context.roundRect(maskStart, trackTop, maskWidth, 35, 8);
	context.clip();
	context.fillRect(clipStart, trackTop, clipWidth, 35);
	context.restore();

	if (selected || clip.hovered) {
		// handles
		context.save();
		context.beginPath();
		context.roundRect(maskStart + 3, 50 + 50 * clip.track + 3, maskWidth - 6, 29, 5);
		context.clip();
		context.fillStyle = '#131315';
		context.fillRect(clipStart + 3, trackTop + 3, 11, 29);
		context.fillRect(clipEnd - 13, trackTop + 3, 11, 29);
		context.restore();

		context.fillStyle = clipColor;

		context.fillRect(clipStart + 7, trackTop + 10, 3, 15);
		context.fillRect(clipEnd - 9, trackTop + 10, 3, 15);

		context.fillStyle = '#131315';

		if (selected) {
			context.fillRect(clipStart + 14, trackTop + 3, clipWidth - 20, 2);
			context.fillRect(clipStart + 14, trackTop + 30, clipWidth - 20, 2);
		}
	}
};
