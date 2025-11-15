import type { Clip } from '$lib/clip/clip.svelte';
import { timelineState } from '$lib/state.svelte';
import { frameToCanvasPixel, secondsToTimecode } from './utils';

const GREEN = '#41a088';
const GREEN_DARK = '#1f4a42';
const GREEN_LIGHT = '#50cfaf';
const PURPLE = '#743bb0';
const PURPLE_DARK = '#361f51';
const PURPLE_LIGHT = '#9941eb';
const BLUE = '#018bb8';
const BLUE_LIGHT = '#1bc7ff';
const BLUE_DARK = '#1e425b';

const PLAYHEAD_PATH = new Path2D(
	'M 10.259 0.2125 h -6.3285 C 1.9385 0.2125 0.3235 1.828 0.3235 3.82 v 6.4675 c 0 1.694 0.408 3.3635 1.189 4.8665 l 2.381 4.5815 c 1.347 2.592 5.0555 2.592 6.402 0 l 2.3825 -4.5865 c 0.7805 -1.503 1.1885 -3.1715 1.1885 -4.865 V 3.82 c 0 -1.992 -1.615 -3.6075 -3.6075 -3.6075 Z M 10.917 6.0255 c 0 1.129 -0.2715 2.215 -0.792 3.217 l -1.2235 2.355 c -0.76 1.463 -2.8535 1.4635 -3.6135 0 l -1.2225 -2.3525 c -0.521 -1.002 -0.7925 -2.0885 -0.7925 -3.2175 v -0.6305 c 0 -1.1245 0.9115 -2.036 2.036 -2.036 h 3.572 c 1.1245 0 2.036 0.9115 2.036 2.036 v 0.628 Z'
);

export const drawCanvas = (
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	waveCanvas: OffscreenCanvas
) => {
	context.fillStyle = '#18181b';
	context.fillRect(0, 0, width, height);

	const flexHeight = height - 35;
	const rulerContainerHeight = flexHeight * 0.2;

	drawRuler(context, rulerContainerHeight);

	// tracks
	const offsetInPixels = timelineState.width * timelineState.zoom * timelineState.offset;

	context.fillStyle = '#111114';
	for (let i = 0; i < timelineState.tracks.length; i++) {
		context.beginPath();
		context.roundRect(
			Math.floor(-offsetInPixels),
			timelineState.tracks[i].top,
			Math.floor(timelineState.width * timelineState.zoom),
			timelineState.tracks[i].height,
			8
		);
		context.fill();
	}

	// clips
	for (const clip of timelineState.clips) {
		const selected = timelineState.selectedClip?.id === clip.id;
		if (selected || clip.deleted || clip.temp || timelineState.selectedClips.has(clip)) continue;
		drawClip(context, clip, width, false, false);
	}

	// draw base for selected clips
	for (const clip of timelineState.selectedClips) {
		drawBaseShape(context, clip, width);
	}

	for (const clip of timelineState.selectedClips) {
		if (clip.deleted) continue;
		drawClip(context, clip, width, false, true);
	}

	if (timelineState.selectedClip && timelineState.trackDropZone < 0) {
		drawBaseShape(context, timelineState.selectedClip, width);
		drawClip(context, timelineState.selectedClip, width, true);
	}

	if (timelineState.trackDropZone > -1) {
		drawInbetweenClip(context, width);
	}

	if (waveCanvas && timelineState.focusedTrack > 0)
		context.drawImage(waveCanvas, 0, timelineState.tracks[timelineState.focusedTrack - 1].top + 25);

	// select box
	if (timelineState.action === 'selecting') {
		const x =
			timelineState.dragOffset.x < 0
				? timelineState.dragStart.x + timelineState.dragOffset.x
				: timelineState.dragStart.x;
		const y =
			timelineState.dragOffset.y < 0
				? timelineState.dragStart.y + timelineState.dragOffset.y
				: timelineState.dragStart.y;
		const boxWidth = Math.abs(timelineState.dragOffset.x);
		const boxHeight = Math.abs(timelineState.dragOffset.y);
		context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
		context.lineWidth = 1;
		context.strokeRect(x + 0.5, y + 0.5, boxWidth, boxHeight);
	}

	// playhead
	const playheadPosition = frameToCanvasPixel(timelineState.currentFrame);
	const playheadTop = rulerContainerHeight * 0.2;
	context.fillStyle = 'white';
	context.fillRect(playheadPosition, playheadTop + 15, 2, flexHeight - 35);

	context.translate(playheadPosition - 6, playheadTop);
	context.fill(PLAYHEAD_PATH);
	context.translate(-playheadPosition + 6, -playheadTop);

	// scrollbar
	if (timelineState.zoom > 0.9) {
		const padding = 0.05 / timelineState.zoom;
		const paddingInPixels = padding * width;
		context.fillStyle = '#3c3c44';
		context.beginPath();
		context.roundRect(
			(timelineState.offset + padding) * width,
			height - 20,
			width / timelineState.zoom - paddingInPixels * 2,
			10,
			8
		);
		context.fill();
	}

	// debug boxes
	/* 	context.fillStyle = 'rgba(255,0,0,0.2)';
	context.fillRect(0, height - 35, 200, 35);

	context.fillStyle = 'rgba(0,255,0,0.2)';
	context.fillRect(0, 0, 200, flexHeight * 0.2);

	context.fillStyle = 'rgba(0,0,255,0.2)';
	context.fillRect(0, flexHeight * 0.2, 200, flexHeight * 0.8); */
};

export const drawWaveform = (context: OffscreenCanvasRenderingContext2D, width: number) => {
	if (timelineState.focusedTrack === 0) return;
	context.clearRect(0, 0, width, 100);
	context.fillStyle = '#131315';

	for (const clip of timelineState.clips) {
		if (clip.track !== timelineState.focusedTrack || clip.deleted || clip.source.type === 'text')
			continue;

		const clipWidth = frameToCanvasPixel(clip.duration, false);
		const clipStartPixel = frameToCanvasPixel(clip.start);

		const fps = 30;
		const startTimeInSeconds = clip.source.type === 'test' ? 0 : clip.sourceOffset / fps;
		const durationInSeconds = clip.duration / fps;

		// 3333.33 is assuming we samples at a rate of 300 per second
		const audioDataLength = Math.floor((durationInSeconds * 1e6) / 3333.33);
		const audioDataOffset = Math.floor((startTimeInSeconds * 1e6) / 3333.33);

		const scaleFactor = audioDataLength / clipWidth;
		const lineWidth = scaleFactor < 0.3 ? 5 : scaleFactor < 0.5 ? 3 : scaleFactor < 1 ? 2 : 1;

		const canvasHeight = 100;
		const waveHeight = 50;

		const testWave = [];
		for (let i = 0; i <= 20; i++) {
			const scaledPosition = i + 1;
			const height = (Math.log(21) - Math.log(scaledPosition)) / Math.log(21);
			testWave.push(Math.max(0, height));
		}

		const maxLines = new Map();
		// Calculate the longest line for each position
		if (clip.source.audioWaveform) {
			for (let i = audioDataOffset, j = 0; i < audioDataOffset + audioDataLength; i++, j++) {
				const position = Math.floor(j / scaleFactor + clipStartPixel);
				if (position < 0 || position > width) continue;

				const value = clip.source.audioWaveform[i];
				if (!maxLines.has(position) || value > maxLines.get(position)) {
					maxLines.set(position, value);
				}
			}
		} else if (clip.source.type === 'test') {
			// test card waveform
			for (let i = audioDataOffset, j = 0; i < audioDataOffset + audioDataLength; i++, j++) {
				const position = Math.floor(j / scaleFactor + clipStartPixel);
				if (position < 0 || position > width) continue;
				let value = 0;
				if ((i - 150) % 300 >= 0 && (i - 150) % 300 <= 20) {
					const relativePosition = (i - 150) % 300;
					value = testWave[relativePosition];
				}
				if (!maxLines.has(position) || value > maxLines.get(position)) {
					maxLines.set(position, value);
				}
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
		}
		context.fill();
		context.closePath();
	}
};

const drawRuler = (context: CanvasRenderingContext2D, containerHeight: number) => {
	//const rulerPosition = (containerHeight - 22) / 2;
	const rulerPosition = (containerHeight - 22) / 1.5;
	const durationInSeconds = timelineState.duration / 30;
	const durationInMinutes = durationInSeconds / 60;
	const minuteInPixels = (timelineState.width / durationInMinutes) * timelineState.zoom;
	const offsetInPixels = timelineState.width * timelineState.zoom * timelineState.offset;

	const startFrame = Math.floor(timelineState.offset * timelineState.duration);
	const endFrame = Math.floor(
		(timelineState.offset + 1 / timelineState.zoom) * timelineState.duration
	);

	context.fillStyle = '#71717b';
	context.font = '13px sen';
	context.letterSpacing = '0.2px';

	// draw every minute
	if (minuteInPixels <= 700) {
		const numberOfMinutesToShow = Math.ceil((endFrame - startFrame) / 1800) + 1;
		let startMinute = Math.floor(startFrame / 1800);
		for (let i = 0; i < numberOfMinutesToShow; i++) {
			const position = Math.floor(minuteInPixels * startMinute - offsetInPixels);
			context.fillRect(position, rulerPosition, 1, 22);
			context.fillText(secondsToTimecode(startMinute * 60), position + 7, rulerPosition + 15);
			startMinute++;
		}
	}

	// draw every 10 seconds
	if (minuteInPixels > 700 && minuteInPixels <= 7000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30 / 6) + 1;
		let startSecond = Math.floor(startFrame / 30 / 10);
		for (let i = 0; i < numberOfSecondsToShow; i++) {
			if (startSecond >= 0) {
				const position = Math.floor((minuteInPixels / 6) * startSecond - offsetInPixels);
				context.fillRect(position, rulerPosition, 1, 22);
				context.fillText(secondsToTimecode(startSecond * 10), position + 7, rulerPosition + 15);
			}
			startSecond++;
		}
	}

	// also draw every 5 seconds
	if (minuteInPixels > 3000 && minuteInPixels <= 7000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30 / 6) + 1;
		let startSecond = Math.floor(startFrame / 30 / 10);
		for (let i = 0; i < numberOfSecondsToShow; i++) {
			if (startSecond >= 0) {
				const position = Math.floor(
					(minuteInPixels / 6) * startSecond - offsetInPixels + minuteInPixels / 12
				);
				context.fillRect(position, rulerPosition, 1, 22);
				context.fillText(secondsToTimecode(startSecond * 10 + 5), position + 7, rulerPosition + 15);
			}
			startSecond++;
		}
	}

	// draw every second
	if (minuteInPixels > 7000) {
		const numberOfSecondsToShow = Math.ceil((endFrame - startFrame) / 30) + 1;
		let startSecond = Math.floor(startFrame / 30);
		for (let i = 0; i < numberOfSecondsToShow; i++) {
			if (startSecond >= 0) {
				const position = Math.floor((minuteInPixels / 60) * startSecond - offsetInPixels);
				context.fillRect(position, rulerPosition, 1, 22);
				context.fillText(secondsToTimecode(startSecond), position + 7, rulerPosition + 15);
			}
			startSecond++;
		}
	}

	// draw every frame
	if (minuteInPixels > 40000) {
		const numberOfFramesToShow = Math.ceil(endFrame - startFrame) + 1;
		let frame = startFrame > 0 ? startFrame : 0;
		for (let i = 0; i < numberOfFramesToShow; i++) {
			if (minuteInPixels < 70000 && (frame - 1) % 30 === 0) {
				frame++;
				continue;
			}
			const position = Math.floor((minuteInPixels / 60 / 30) * frame - offsetInPixels);
			context.fillRect(position, rulerPosition + 9, 1, 5);
			frame++;
		}
	}
};

const drawClip = (
	context: CanvasRenderingContext2D,
	clip: Clip,
	width: number,
	selected = false,
	multiSelected = false
) => {
	let clipColor = selected || multiSelected ? GREEN_LIGHT : GREEN;
	let clipBaseColor = GREEN;
	let clipDarkColor = GREEN_DARK;
	if (clip.source.type === 'text') {
		clipColor = selected || multiSelected ? PURPLE_LIGHT : PURPLE;
		clipBaseColor = PURPLE;
		clipDarkColor = PURPLE_DARK;
	} else if (clip.source.type === 'audio') {
		clipColor = selected || multiSelected ? BLUE_LIGHT : BLUE;
		clipBaseColor = BLUE;
		clipDarkColor = BLUE_DARK;
	}

	const gap = 3;
	const trackTop = timelineState.tracks[clip.track - 1].top;
	const clipHeight =
		timelineState.tracks[clip.track - 1].height > 35
			? 35
			: timelineState.tracks[clip.track - 1].height;

	const startPercent = clip.start / timelineState.duration - timelineState.offset;
	const endPercent = (clip.start + clip.duration) / timelineState.duration - timelineState.offset;

	const clipFullStart = Math.floor(startPercent * width * timelineState.zoom);
	const clipFullEnd = Math.floor(endPercent * width * timelineState.zoom);

	const clipStart = clipFullStart + 1;
	const clipWidth = clipFullEnd - clipFullStart - gap;
	const clipEnd = clipFullEnd - gap;

	const maskStart = clip.joinLeft ? clipStart - 20 : clipStart;
	let maskWidth = clipWidth;
	if (clip.joinLeft || clip.joinRight) maskWidth = clipWidth + 20;
	if (clip.joinLeft && clip.joinRight) maskWidth = clipWidth + 40;

	// TODO:  clip should not be a seperate draw call

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

	if (clipWidth < 10) return;

	if (selected || multiSelected) {
		context.strokeStyle = '#131315';
		context.lineWidth = 3;
		context.beginPath();
		context.roundRect(clipStart + 4.5, trackTop + 4.5, clipWidth - 9, clipHeight - 9, [
			clip.joinLeft ? 0 : 5,
			clip.joinRight ? 0 : 5,
			clip.joinRight ? 0 : 5,
			clip.joinLeft ? 0 : 5
		]);
		if (!selected) context.fillStyle = clipBaseColor;
		context.fill();
		context.stroke();

		//context.fillRect(clipStart + 14, trackTop + 3, clipWidth - 20, 3);
		//context.fillRect(clipStart + 14, trackTop + clipHeight - 6, clipWidth - 20, 3);
	}
	if (clipWidth < 32) return;
	if (selected || (clip.hovered && !multiSelected)) {
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
	}
};

const drawInbetweenClip = (context: CanvasRenderingContext2D, width: number) => {
	const clip = timelineState.selectedClip;
	if (!clip) return;

	let clipColor = GREEN_LIGHT;
	if (clip.source.type === 'text') {
		clipColor = PURPLE_LIGHT;
	}

	const flexHeight = timelineState.height - 35;
	const trackContainerHeight = flexHeight * 0.8;

	const startPercent = clip.start / timelineState.duration - timelineState.offset;
	const endPercent = (clip.start + clip.duration) / timelineState.duration - timelineState.offset;

	const clipStart = Math.round(startPercent * width * timelineState.zoom);
	const clipEnd = Math.round(endPercent * width * timelineState.zoom);
	let clipTop = 0;
	if (timelineState.trackDropZone === 0) {
		clipTop = timelineState.tracks[0].top - 10;
	} else {
		clipTop =
			timelineState.tracks[timelineState.trackDropZone - 1].top +
			timelineState.tracks[timelineState.trackDropZone - 1].height +
			(trackContainerHeight < 220 ? 0 : 5);
	}
	context.fillStyle = clipColor;
	context.beginPath();
	context.roundRect(clipStart, clipTop, clipEnd - clipStart, 5, 2);
	context.fill();
};

const drawBaseShape = (context: CanvasRenderingContext2D, clip: Clip, width: number) => {
	const gap = 3;
	const trackTop = timelineState.tracks[clip.track - 1].top;
	const clipHeight =
		timelineState.tracks[clip.track - 1].height > 35
			? 35
			: timelineState.tracks[clip.track - 1].height;

	const startPercent = clip.start / timelineState.duration - timelineState.offset;
	const endPercent = (clip.start + clip.duration) / timelineState.duration - timelineState.offset;

	const clipFullStart = Math.floor(startPercent * width * timelineState.zoom);
	const clipFullEnd = Math.floor(endPercent * width * timelineState.zoom);

	const clipStart = clipFullStart + 1;
	const clipWidth = clipFullEnd - clipFullStart - gap;
	context.fillStyle = '#131315';
	context.beginPath();
	context.roundRect(clipStart - 3, trackTop - 3, clipWidth + 6, clipHeight + 6, 11);
	context.fill();
};
