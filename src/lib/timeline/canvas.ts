import type { Clip } from '$lib/clip/clip.svelte';
import { appState, programState, timelineState } from '$lib/state.svelte';
import { canvasPixelToFrame, frameToCanvasPixel, secondsToTimecode } from './utils';
import { programFrameToCanvasPixel } from '$lib/program/utils';
import { getKeyframePositionHelpers } from '$lib/clip/utils';

const COLORS = {
	zinc: {
		900: '#18181b'
	},
	green: {
		400: '#50cfaf',
		500: '#41a088',
		600: '#1f4a42'
	},
	purple: {
		400: '#9941eb',
		500: '#743bb0',
		600: '#361f51'
	},
	blue: {
		400: '#1bc7ff',
		500: '#018bb8',
		600: '#1e425b'
	}
};

const PLAYHEAD_PATH = new Path2D(
	'M 10.259 0.2125 h -6.3285 C 1.9385 0.2125 0.3235 1.828 0.3235 3.82 v 6.4675 c 0 1.694 0.408 3.3635 1.189 4.8665 l 2.381 4.5815 c 1.347 2.592 5.0555 2.592 6.402 0 l 2.3825 -4.5865 c 0.7805 -1.503 1.1885 -3.1715 1.1885 -4.865 V 3.82 c 0 -1.992 -1.615 -3.6075 -3.6075 -3.6075 Z M 10.917 6.0255 c 0 1.129 -0.2715 2.215 -0.792 3.217 l -1.2235 2.355 c -0.76 1.463 -2.8535 1.4635 -3.6135 0 l -1.2225 -2.3525 c -0.521 -1.002 -0.7925 -2.0885 -0.7925 -3.2175 v -0.6305 c 0 -1.1245 0.9115 -2.036 2.036 -2.036 h 3.572 c 1.1245 0 2.036 0.9115 2.036 2.036 v 0.628 Z'
);
const MARKER_PATH = new Path2D(
	'M11.3087 5.9281c0 1.2419-.2987 2.4365-.8712 3.5387l-1.3459 2.5905c-.836 1.6093-3.1389 1.6099-3.9749 0l-1.3448-2.5878c-.5731-1.1022-.8718-2.2973-.8718-3.5393v-.6935c0-1.237 1.0027-2.2396 2.2396-2.2396h3.9292c1.237 0 2.2396 1.0027 2.2396 2.2396v.6908Z '
);

const PARAM_NAMES = [
	'size - width',
	'size - height',
	'position - x',
	'position - y',
	'gain',
	'pan',
	'font size',
	'line space',
	'justify',
	'red',
	'green',
	'blue',
	'crop - top',
	'crop - right',
	'crop - bottom',
	'crop - left',
	'rounded corners',
	'rotation',
	'opacity',
	'exposure',
	'contrast',
	'saturation',
	'write on'
];

export const drawCanvas = (
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	waveCanvas: OffscreenCanvas
) => {
	context.fillStyle = COLORS.zinc[900];
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
		if (
			selected ||
			clip.deleted ||
			clip.temp ||
			timelineState.selectedClips.has(clip) ||
			clip.track < 1
		)
			continue;
		drawClip(context, clip, width, false, false);
	}

	// draw base for selected clips
	for (const clip of timelineState.selectedClips) {
		if (clip.deleted) continue;
		drawBaseShape(context, clip, width);
	}

	for (const clip of timelineState.selectedClips) {
		if (clip.deleted) continue;
		drawClip(context, clip, width, false, true);
	}

	if (
		timelineState.selectedClip &&
		timelineState.trackDropZone < 0 &&
		timelineState.selectedClip.track > 0
	) {
		drawBaseShape(context, timelineState.selectedClip, width);
		drawClip(context, timelineState.selectedClip, width, true);
	}

	if (timelineState.trackDropZone > -1) {
		drawInbetweenClip(context, width);
	}

	if (waveCanvas && timelineState.focusedTrack > 0)
		context.drawImage(waveCanvas, 0, timelineState.tracks[timelineState.focusedTrack - 1].top + 42);

	// keyframes
	if (
		timelineState.focusedTrack > 0 &&
		appState.selectedKeyframeParam > -1 &&
		timelineState.selectedClip &&
		timelineState.selectedClip.keyframeTracks.has(appState.selectedKeyframeParam)
	) {
		drawKeyframes(context, width, height);
	}

	// select box
	if (timelineState.action === 'selecting') {
		const dragOffsetX = timelineState.mousePosition.x - timelineState.mouseDownPosition.x;
		const dragOffsetY = timelineState.mousePosition.y - timelineState.mouseDownPosition.y;
		const x =
			dragOffsetX < 0
				? timelineState.mouseDownPosition.x + dragOffsetX
				: timelineState.mouseDownPosition.x;
		const y =
			dragOffsetY < 0
				? timelineState.mouseDownPosition.y + dragOffsetY
				: timelineState.mouseDownPosition.y;
		const boxWidth = Math.abs(dragOffsetX);
		const boxHeight = Math.abs(dragOffsetY);
		context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
		context.lineWidth = 1;
		context.strokeRect(x + 0.5, y + 0.5, boxWidth, boxHeight);
	}

	// playhead
	if (timelineState.showPlayhead) {
		const playheadPosition = frameToCanvasPixel(timelineState.currentFrame);
		const playheadTop = rulerContainerHeight * 0.2;
		drawPlayhead(context, rulerContainerHeight * 0.2, flexHeight - playheadTop, playheadPosition);
	}

	if (
		timelineState.selectedTool === 'scissors' &&
		timelineState.mousePosition.y > rulerContainerHeight
	) {
		const cursorPosition = frameToCanvasPixel(canvasPixelToFrame(timelineState.mousePosition.x));
		context.fillStyle = 'rgba(255, 255, 255, 0.6)';
		context.fillRect(
			cursorPosition,
			flexHeight * 0.2 + flexHeight * 0.02,
			1,
			flexHeight * 0.8 - flexHeight * 0.04
		);
	}

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
	/* context.fillStyle = 'rgba(255,0,0,0.2)';
	context.fillRect(0, height - 35, 200, 35);

	context.fillStyle = 'rgba(0,255,0,0.2)';
	context.fillRect(0, 0, 200, flexHeight * 0.2);

	context.fillStyle = 'rgba(0,0,255,0.2)';
	context.fillRect(0, flexHeight * 0.2, 200, flexHeight * 0.8); */
};

export const drawSourceCanvas = (
	context: CanvasRenderingContext2D,
	width: number,
	height: number
) => {
	if (!appState.selectedSource) return;

	context.fillStyle = COLORS.zinc[900];
	context.fillRect(0, 0, width, height);

	context.fillStyle = '#34343c';
	context.beginPath();
	context.roundRect(10, 25, width - 20, 8, 4);
	context.fill();

	const inPosition = programFrameToCanvasPixel(appState.selectedSource.selection.in);
	drawMarker(context, 8, inPosition - 1);

	const outPosition = programFrameToCanvasPixel(appState.selectedSource.selection.out);
	drawMarker(context, 8, outPosition);

	context.fillStyle = '#696971';
	context.save();
	context.beginPath();
	context.rect(inPosition, 25, outPosition - inPosition, 8);
	context.clip();
	context.beginPath();
	context.roundRect(10, 25, width - 20, 8, 4);
	context.fill();
	context.restore();

	context.fillStyle = COLORS.zinc[900];
	context.fillRect(inPosition - 3, 25, 3, 8);
	context.fillRect(outPosition, 25, 3, 8);

	const playheadPosition = programFrameToCanvasPixel(programState.currentFrame);
	drawPlayhead(context, 8, 32, playheadPosition);
};

const drawMarker = (context: CanvasRenderingContext2D, top: number, position: number) => {
	context.fillStyle = '#73737c';
	context.translate(position - 6, top);
	context.fill(MARKER_PATH);
	context.translate(-position + 6, -top);
};

const drawPlayhead = (
	context: CanvasRenderingContext2D,
	top: number,
	length: number,
	position: number
) => {
	context.fillStyle = 'white';
	context.fillRect(position, top + 15, 2, length - 15);

	context.translate(position - 6, top);
	context.fill(PLAYHEAD_PATH);
	context.translate(-position + 6, -top);
};

const getClipPalette = (clip: Clip, selected = false, multiSelected = false) => {
	const tint =
		clip.source.type === 'text' || clip.source.type === 'image'
			? 'purple'
			: clip.source.type === 'audio'
				? 'blue'
				: 'green';
	let clipColor = selected || multiSelected ? COLORS[tint][400] : COLORS[tint][500];
	let clipBaseColor = COLORS[tint][500];
	let clipDarkColor = COLORS[tint][600];

	if (clip.invalid) {
		clipColor = '#2b2d30';
		clipBaseColor = '#2b2d30';
		clipDarkColor = '#2b2d30';
	}

	if (clip.source.unlinked) {
		clipColor = '#dc2626';
		clipBaseColor = '#7f1d1d';
		clipDarkColor = '#5e1919';
	}

	return { clipColor, clipBaseColor, clipDarkColor };
};

const drawRuler = (context: CanvasRenderingContext2D, containerHeight: number) => {
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
	const { clipColor, clipBaseColor, clipDarkColor } = getClipPalette(clip, selected, multiSelected);

	const gap = 3;
	const trackTop = timelineState.tracks[clip.track - 1].top;
	const clipHeight =
		timelineState.tracks[clip.track - 1].height > 35
			? 35
			: timelineState.tracks[clip.track - 1].height;

	const { clipStart, clipWidth, clipEnd } = getClipPixelMetrics(clip, width, gap);

	const maskStart = clip.joinLeft ? clipStart - 20 : clipStart;
	let maskWidth = clipWidth;
	if (clip.joinLeft || clip.joinRight) maskWidth = clipWidth + 20;
	if (clip.joinLeft && clip.joinRight) maskWidth = clipWidth + 40;

	// TODO:  clip should not be a seperate draw call

	// focus shapes
	if (clip.track === timelineState.focusedTrack && !clip.invalid) {
		context.fillStyle = clipDarkColor;
		context.beginPath();
		context.roundRect(clipStart, trackTop, clipWidth, clipHeight + 90, 8);
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
		if (!selected || clip.invalid) context.fillStyle = clipBaseColor;
		//if (clip.invalid && pattern) context.fillStyle = pattern;
		//if (clip.invalid) context.fillStyle = clipBaseColor;
		context.fill();
		context.stroke();
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

	const { clipColor } = getClipPalette(clip, true);

	const flexHeight = timelineState.height - 35;
	const trackContainerHeight = flexHeight * 0.8;

	const { clipFullStart, clipFullEnd } = getClipEdgePositions(clip, width);

	const clipStart = Math.round(clipFullStart);
	const clipEnd = Math.round(clipFullEnd);
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
	let clipHeight =
		timelineState.tracks[clip.track - 1].height > 35
			? 35
			: timelineState.tracks[clip.track - 1].height;

	if (clip.track === timelineState.focusedTrack && !clip.invalid) clipHeight += 90;

	const { clipStart, clipWidth } = getClipPixelMetrics(clip, width, gap);

	context.fillStyle = '#131315';
	context.beginPath();
	context.roundRect(clipStart - 3, trackTop - 3, clipWidth + 6, clipHeight + 6, 11);
	context.fill();
};

export const drawWaveforms = (context: OffscreenCanvasRenderingContext2D, width: number) => {
	if (timelineState.focusedTrack === 0) return;
	context.clearRect(0, 0, width, 80);
	context.fillStyle = '#131315';

	for (const clip of timelineState.clips) {
		if (
			(timelineState.selectedClip && clip.id === timelineState.selectedClip.id) ||
			clip.track !== timelineState.focusedTrack ||
			clip.deleted ||
			clip.invalid ||
			clip.source.type === 'text'
		)
			continue;
		drawClipWaveform(context, clip, width);
	}

	if (timelineState.selectedClip) {
		const clip = timelineState.selectedClip;
		if (clip.track !== timelineState.focusedTrack || clip.source.type === 'text' || clip.invalid)
			return;
		drawClipWaveform(context, clip, width);
	}
};

const drawClipWaveform = (
	context: OffscreenCanvasRenderingContext2D,
	clip: Clip,
	width: number
) => {
	const clipWidth = frameToCanvasPixel(clip.duration, false);
	const clipStartPixel = frameToCanvasPixel(clip.start);

	context.clearRect(clipStartPixel, 0, clipWidth, 80);

	const fps = 30;
	const startTimeInSeconds = clip.source.type === 'test' ? 0 : clip.sourceOffset / fps;
	const durationInSeconds = clip.duration / fps;

	// 3333.33 is assuming we samples at a rate of 300 per second
	const audioDataLength = Math.floor((durationInSeconds * 1e6) / 3333.33);
	const audioDataOffset = Math.floor((startTimeInSeconds * 1e6) / 3333.33);

	const scaleFactor = audioDataLength / clipWidth;
	const lineWidth = scaleFactor < 0.3 ? 5 : scaleFactor < 0.5 ? 3 : scaleFactor < 1 ? 2 : 1;

	const canvasHeight = 80;
	const waveHeight = 70;

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
};

const getClipEdgePositions = (clip: Clip, width: number) => {
	const startPercent = clip.start / timelineState.duration - timelineState.offset;
	const endPercent = (clip.start + clip.duration) / timelineState.duration - timelineState.offset;

	return {
		clipFullStart: Math.floor(startPercent * width * timelineState.zoom),
		clipFullEnd: Math.floor(endPercent * width * timelineState.zoom)
	};
};

const drawKeyframe = (context: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
	context.beginPath();
	context.moveTo(x + 1 * scale, y - 5 * scale);
	context.lineTo(x + 6 * scale, y);
	context.lineTo(x + 1 * scale, y + 5 * scale);
	context.lineTo(x - 4 * scale, y);
	context.closePath();
	context.fill();
};

const drawKeyframes = (context: CanvasRenderingContext2D, width: number, height: number) => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const keyframeTrack = clip.keyframeTracks.get(appState.selectedKeyframeParam);
	const { clipFullStart, clipFullEnd } = getClipEdgePositions(clip, width);
	const { clipBaseColor } = getClipPalette(clip);

	if (keyframeTrack && keyframeTrack.keyframes.length > 0) {
		const { getFrameX, getValY } = getKeyframePositionHelpers(clip, keyframeTrack);
		const keyframes = keyframeTrack.keyframes;
		const count = keyframes.length;

		context.save();
		context.beginPath();
		context.rect(0, 0, width, height);

		for (const keyframe of keyframes) {
			const x = getFrameX(keyframe.frame);
			const y = getValY(keyframe.value);
			const maskSize = 9;
			context.moveTo(x + maskSize, y);
			context.arc(x + 1, y, maskSize, 0, Math.PI * 2);
		}

		context.clip('evenodd');
		context.beginPath();
		context.strokeStyle = 'white';
		context.lineWidth = 1.5;

		const firstX = getFrameX(keyframes[0].frame);
		const firstY = getValY(keyframes[0].value);
		context.moveTo(clipFullStart, firstY);
		if (count > 1) {
			context.lineTo(firstX, firstY);
		}

		for (let i = 0; i < count - 1; i++) {
			const x0 = getFrameX(keyframes[i].frame);
			const y0 = getValY(keyframes[i].value);
			const x1 = getFrameX(keyframes[i + 1].frame);
			const y1 = getValY(keyframes[i + 1].value);

			const distanceX = x1 - x0;

			if (keyframes[i].easeOut === 0) {
				context.lineTo(x1, y0);
				context.lineTo(x1, y1);
				continue;
			}

			const outTension = keyframes[i].easeOut === 2 ? 0.4 : 0;
			const inTension = keyframes[i + 1].easeIn === 2 ? 0.4 : 0;
			const cp1x = x0 + distanceX * outTension;
			const cp2x = x1 - distanceX * inTension;
			context.bezierCurveTo(cp1x, y0, cp2x, y1, x1, y1);
		}

		const lastY = getValY(keyframes[count - 1].value);
		context.lineTo(clipFullEnd, lastY);
		context.stroke();
		context.restore();

		context.fillStyle = 'white';
		for (const keyframe of keyframeTrack.keyframes) {
			const x = getFrameX(keyframe.frame);
			const y = getValY(keyframe.value);
			drawKeyframe(context, x, y, 0.9);
		}
	}

	const trackTop = timelineState.tracks[timelineState.focusedTrack - 1].top;
	const labelLeft = clipFullStart > -15 ? clipFullStart : -15;
	context.font = '700 12px sen';
	context.letterSpacing = '-0.2px';
	const text = PARAM_NAMES[appState.selectedKeyframeParam];
	const textWidth = context.measureText(text).width;
	if (labelLeft + textWidth + 90 < clipFullEnd) {
		context.fillStyle = clipBaseColor;
		context.beginPath();
		context.roundRect(labelLeft + 30, trackTop + 8, textWidth + 32, 19, 6);
		context.fill();

		context.fillStyle = '#000';
		context.fillText(text, labelLeft + 52, trackTop + 21);
		drawKeyframe(context, labelLeft + 41, trackTop + 18, 0.8);
	}
};

const getClipPixelMetrics = (clip: Clip, width: number, gap = 3) => {
	const { clipFullStart, clipFullEnd } = getClipEdgePositions(clip, width);
	const clipStart = clipFullStart + 1;
	const clipWidth = clipFullEnd - clipFullStart - gap;
	const clipEnd = clipFullEnd - gap;

	return { clipFullStart, clipFullEnd, clipStart, clipWidth, clipEnd };
};
