import { appState, Clip, Source, timelineState } from '$lib/state.svelte';
import { canvasPixelToFrame } from './utils';
import { VideoClip, VideoSource, Source as coreSource } from '@diffusionstudio/core';

export const setCurrentFrame = (frame: number) => {
	appState.composition?.seek(frame);
	//timelineState.currentFrame = frame;
};

export const setFrameFromOffset = (canvasOffset: number) => {
	timelineState.playing = false;
	let frame = canvasPixelToFrame(canvasOffset);
	if (frame > 8999) frame = 8999;
	setCurrentFrame(frame);
};

export const createSource = async (url: string) => {
	const videoSource = await coreSource.from<VideoSource>(url, { prefetch: false });
	appState.sources.push(new Source(videoSource));
};

export const getSourceFromId = (id: string) => {
	let foundSource;
	for (const source of appState.sources) {
		if (source.id === id) {
			foundSource = source;
		}
	}
	return foundSource;
};

export const centerViewOnPlayhead = () => {
	const playheadPercent = timelineState.currentFrame / timelineState.duration;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	timelineState.offset = playheadPercent - percentOfTimelineVisible / 2;
};

export const checkViewBounds = () => {
	const padding = 0.05 / timelineState.zoom;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	const maxPercentAllowed = 1 - percentOfTimelineVisible;
	if (timelineState.offset < 0) {
		timelineState.offset = 0 - padding;
	}
	if (timelineState.offset > maxPercentAllowed + padding)
		timelineState.offset = maxPercentAllowed + padding;
};

export const zoomIn = () => {
	if (timelineState.zoom < 220) timelineState.zoom = timelineState.zoom * 2;
	centerViewOnPlayhead();
	checkViewBounds();
	timelineState.invalidate = true;
};

export const zoomOut = () => {
	if (timelineState.zoom > 0.9) timelineState.zoom = timelineState.zoom / 2;
	checkViewBounds();
	timelineState.invalidate = true;
};

export const updateScrollPosition = () => {
	const padding = 0.05 / timelineState.zoom;
	const offsetPercent = timelineState.dragOffset / timelineState.width;
	timelineState.offset = timelineState.offsetStart + offsetPercent;
	if (timelineState.offset < 0 - padding) timelineState.offset = 0 - padding;
	const barWidth = 1 / timelineState.zoom;
	if (timelineState.offset + barWidth >= 1 + padding) timelineState.offset = 1 - barWidth + padding;
};

export const createClip = async (sourceId: string) => {
	const source = getSourceFromId(sourceId);
	if (!source) return;

	const videoClip = new VideoClip(source.videoSource, {
		// also accepts files/blobs or urls
		position: 'center', // ensures the clip is centered
		height: 1080 // Math.random() * 1000 // stretches the clip to the full height
	});

	await appState.composition?.add(videoClip);

	const clip = new Clip(videoClip, source);

	timelineState.clips.push(clip);
	timelineState.invalidate = true;
};

export const updateClipCore = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	if (clip.resizeHover === 'none') {
		clip.videoClip.offset(clip.start - clip.savedStart);
	} else {
		clip.videoClip.trim(clip.start, clip.start + clip.duration);
	}
};

export const moveSelectedClip = () => {
	const frame = canvasPixelToFrame(timelineState.dragOffset, false);
	const clip = timelineState.selectedClip;
	if (!clip) return;
	clip.start = clip.savedStart + frame;

	if (clip.start < 0) {
		clip.start = 0;
	}
	if (clip.start + clip.duration > timelineState.duration) {
		clip.start = timelineState.duration - clip.duration;
	}
};

export const resizeSelctedClip = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;

	clip.invalid = false;
	const frameOffset = canvasPixelToFrame(timelineState.dragOffset, false);
	if (clip.resizeHover === 'start') {
		clip.start = clip.savedStart + frameOffset;
		clip.duration = clip.savedDuration - frameOffset;
		clip.sourceOffset = clip.savedSourceOffset + frameOffset;

		if (clip.sourceOffset < 0) {
			// going past start of source
			clip.start = clip.savedStart - clip.savedSourceOffset;
			clip.duration = clip.savedDuration + clip.savedSourceOffset;
			clip.sourceOffset = 0;
			clip.invalid = true;
		} else if (clip.duration < 200) {
			// clip too short
			clip.start = clip.savedStart + clip.savedDuration - 200;
			clip.duration = 200;
			clip.sourceOffset = clip.savedSourceOffset + clip.savedDuration - 200;
		}
	} else if (clip.resizeHover === 'end') {
		clip.duration = clip.savedDuration + frameOffset;
		const maxLength = clip.source.duration - clip.sourceOffset;

		if (clip.duration > maxLength) {
			// going past end of source
			clip.duration = maxLength;
			clip.invalid = true;
		} else if (clip.duration < 200) {
			// clip too short
			clip.duration = 200;
		}
	}
};

export const removeHoverAllClips = () => {
	for (const clip of timelineState.clips) {
		clip.hovered = false;
	}
};

export const removeInvalidAllClips = () => {
	for (const clip of timelineState.clips) {
		clip.invalid = false;
	}
};

export const setClipHover = (hoveredFrame: number, offsetY: number) => {
	let foundClip;
	for (const clip of timelineState.clips) {
		clip.hovered = false;
		if (offsetY > 40 && offsetY < 80) {
			if (hoveredFrame < clip.start + clip.duration && hoveredFrame >= clip.start) {
				foundClip = clip;
				clip.hovered = true;
				timelineState.hoverClipId = clip.id;
				break;
			}
		}
	}
	return foundClip;
};

export const getClipFromId = (id: string) => {
	let foundClip;
	for (const clip of timelineState.clips) {
		if (clip.id === id) {
			foundClip = clip;
			break;
		}
	}
	return foundClip ?? null;
};
