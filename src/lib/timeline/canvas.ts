import type { Clip } from '$lib/clip/clip.svelte';
import { timelineState } from '$lib/state.svelte';
import { frameToCanvasPixel, secondsToTimecode } from './utils';

const GREEN = '#50cfaf';
const GREEN_DARK = '#1f4a42';
const PURPLE = '#8b4fcf';
const PURPLE_DARK = '#361f51';
const BLUE = '#419fda';
const BLUE_DARK = '#1e425b';

const PLAYHEAD_PATH = new Path2D(
	'M 3.966 0.2 h 6.3285 c 1.992 0 3.6075 1.615 3.6075 3.6075 v 9.4965 c 0 1.6935 \
	-0.4075 3.3625 -1.1885 4.865 l -2.3825 4.5865 c -1.3465 2.592 -5.055 2.5925 -6.402 \
	0 l -2.381 -4.5815 c -0.781 -1.503 -1.189 -3.1725 -1.189 -4.8665 V 3.8075 c 0 -1.992  \
	1.615 -3.6075 3.6075 -3.6075 Z'
);

const PLAYHEAD_INSET_PATH = new Path2D(
	'M 5.3445 3.3485 h 3.572 c 1.1245 0 2.036 0.9115 2.036 2.036 v 3.6345 c 0 1.129 \
	-0.2715 2.2415 -0.792 3.2435 l -1.2235 2.355 c -0.76 1.463 -2.8535 1.4635 -3.6135 \
	0 l -1.2225 -2.3525 c -0.521 -1.002 -0.7925 -2.115 -0.7925 -3.2445 v -3.6365 c 0 \
	-1.1245 0.9115 -2.036 2.036 -2.036 Z'
);

export const drawCanvas = (
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	waveCanvas: OffscreenCanvas
) => {
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
	context.fillStyle = '#111114';
	for (let i = 0; i < 4; i++) {
		context.beginPath();
		context.roundRect(
			Math.floor(-offsetInPixels),
			timelineState.trackTops[i],
			Math.floor(timelineState.width * timelineState.zoom),
			timelineState.trackHeights[i],
			8
		);
		context.fill();
	}

	// clips
	for (const clip of timelineState.clips) {
		const selected = timelineState.selectedClip?.id === clip.id;
		if (selected || clip.deleted) continue;
		drawClip(context, clip, width);
	}

	if (timelineState.selectedClip) drawClip(context, timelineState.selectedClip, width, true);

	if (waveCanvas && timelineState.focusedTrack > 0)
		context.drawImage(waveCanvas, 0, timelineState.trackTops[timelineState.focusedTrack - 1] + 25);

	// playhead
	const playheadPosition = frameToCanvasPixel(timelineState.currentFrame);
	context.fillStyle = 'white';
	context.fillRect(playheadPosition, 20, 2, height - 80);

	context.translate(playheadPosition - 6, 12);
	context.fill(PLAYHEAD_PATH);
	context.fillStyle = '#18181b';
	context.fill(PLAYHEAD_INSET_PATH);
	context.translate(-playheadPosition + 6, -12);
};

export const drawWaveform = (context: OffscreenCanvasRenderingContext2D) => {
	if (timelineState.focusedTrack === 0) return;
	context.clearRect(0, 0, 2000, 100);
	context.fillStyle = '#131315';

	//let count = 0;
	for (const clip of timelineState.clips) {
		if (
			clip.track !== timelineState.focusedTrack ||
			clip.deleted ||
			clip.source.type === 'text' ||
			clip.source.type === 'test'
		)
			continue;

		const clipWidth = frameToCanvasPixel(clip.duration, false);
		const clipStartPixel = frameToCanvasPixel(clip.start);

		const fps = 30;
		const startTimeInSeconds = clip.sourceOffset / fps;
		const durationInSeconds = clip.duration / fps;

		// 3333.33 is assuming we samples at a rate of 300 per second
		const audioDataLength = Math.floor((durationInSeconds * 1e6) / 3333.33);
		const audioDataOffset = Math.floor((startTimeInSeconds * 1e6) / 3333.33);

		const scaleFactor = audioDataLength / clipWidth;
		const lineWidth = scaleFactor < 0.4 ? 3 : scaleFactor < 1 ? 2 : 1;

		const canvasHeight = 100;
		const waveHeight = 50;
		if (clip.source && clip.source.audioWaveform) {
			const data = clip.source.audioWaveform;

			const maxLines = new Map();
			// Calculate the longest line for each position
			for (let i = audioDataOffset, j = 0; i < audioDataOffset + audioDataLength; i++, j++) {
				const position = Math.floor(j / scaleFactor + clipStartPixel);
				if (position < 0 || position > 2000) {
					continue;
				}
				const value = data[i];
				if (!maxLines.has(position) || value > maxLines.get(position)) {
					maxLines.set(position, value);
				}
			}

			context.beginPath();
			for (const [position, value] of maxLines) {
				context.rect(
					position,
					canvasHeight / 2 - (value * waveHeight) / 2,
					lineWidth,
					value * waveHeight
				);
				//count++;
			}
			context.fill(); // Fill the entire path with the specified fillStyle
			context.closePath();
		}
	}
	//console.log(`drawn: ${count}`);
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
	let clipDarkColor = GREEN_DARK;
	if (clip.source.type === 'text') {
		clipColor = PURPLE;
		clipDarkColor = PURPLE_DARK;
	} else if (clip.source.type === 'audio') {
		clipColor = BLUE;
		clipDarkColor = BLUE_DARK;
	}

	const gap = 3;
	const trackTop = timelineState.trackTops[clip.track - 1];
	const clipHeight = timelineState.trackHeights[clip.track - 1];

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

	// TODO: each clip should not be a seperate draw call

	// focus shapes
	if (clip.track === timelineState.focusedTrack) {
		context.fillStyle = clipDarkColor;
		context.beginPath();
		context.roundRect(clipStart, trackTop, clipWidth, clipHeight + 75, 8);
		context.fill();
	}

	// base shape
	context.fillStyle = clipColor;

	if (clipWidth < 6) {
		context.fillRect(clipStart + 1, trackTop, 3, clipHeight);
		return;
	}

	context.save();
	context.beginPath();
	context.roundRect(maskStart, trackTop, maskWidth, clipHeight, 8);
	context.clip();
	context.fillRect(clipStart, trackTop, clipWidth, clipHeight);
	context.restore();

	if (selected || clip.hovered) {
		// handles
		context.save();
		context.beginPath();
		context.roundRect(maskStart + 3, trackTop + 3, maskWidth - 6, clipHeight - 6, 5);
		context.clip();

		context.fillStyle = '#131315';
		context.fillRect(clipStart + 3, trackTop + 3, 11, clipHeight - 6);
		context.fillRect(clipEnd - 13, trackTop + 3, 11, clipHeight - 6);
		context.restore();

		context.fillStyle = clipColor;

		context.fillRect(clipStart + 7, trackTop + 10, 3, clipHeight - 20);
		context.fillRect(clipEnd - 9, trackTop + 10, 3, clipHeight - 20);

		context.fillStyle = '#131315';

		if (selected) {
			context.fillRect(clipStart + 14, trackTop + 3, clipWidth - 20, 2);
			context.fillRect(clipStart + 14, trackTop + clipHeight - 5, clipWidth - 20, 2);
		}
	}
};
