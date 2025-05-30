import { appState, Clip, Source, timelineState } from '$lib/state.svelte';
import { canvasOffsetToFrame } from './utils';
import { VideoClip, VideoSource, Source as coreSource } from '@diffusionstudio/core';

export const setCurrentFrame = (frame: number) => {
	appState.composition?.seek(frame);
};

export const setFrameFromOffset = (canvasOffset: number) => {
	timelineState.playing = false;
	setCurrentFrame(canvasOffsetToFrame(canvasOffset));
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
	const clip = getClipFromId(timelineState.selectedClipId);
	if (!clip) return;
	if (clip.resizeHover === 'none') {
		const frame = canvasOffsetToFrame(timelineState.dragOffset);
		clip.videoClip.offset(frame);
	} else {
		clip.videoClip.trim(clip.start, clip.start + clip.duration);
	}
};

export const moveSelectedClip = () => {
	const frame = canvasOffsetToFrame(timelineState.dragOffset);
	const clip = getClipFromId(timelineState.selectedClipId);
	if (!clip) return;
	clip.start = clip.dragStart + frame;

	//clip.videoClip.offset(frame);
};

export const resizeSelctedClip = () => {
	const clip = getClipFromId(timelineState.selectedClipId);
	if (!clip) return;

	const frameOffset = canvasOffsetToFrame(timelineState.dragOffset);
	if (clip.resizeHover === 'start') {
		/* const oldOffset = clip.sourceOffset; */
		clip.sourceOffset = clip.dragSourceOffset + frameOffset;

		if (clip.sourceOffset < 0) {
			// out of bounds
			clip.start = clip.dragStart - clip.dragSourceOffset;
			clip.duration = clip.dragDuration + clip.dragSourceOffset;
			clip.sourceOffset = 0;
		} else {
			clip.start = clip.dragStart + frameOffset;
			clip.duration = clip.dragDuration - frameOffset;
		}

		//clip.videoClip.trim(clip.start, clip.start + clip.duration);
	} else if (clip.resizeHover === 'end') {
		clip.duration = clip.dragDuration + frameOffset;
		const maxLength = clip.source.duration - clip.sourceOffset;

		if (clip.duration > maxLength) clip.duration = maxLength;

		//clip.videoClip.trim(clip.start, clip.start + clip.duration);
	}
};

export const dehoverAllClips = () => {
	for (const clip of timelineState.clips) {
		clip.hovered = false;
	}
};

export const setClipHover = (hoveredFrame: number, offsetY: number) => {
	let foundClip;
	for (const clip of timelineState.clips) {
		clip.hovered = false;
		if (offsetY > 40 && offsetY < 80) {
			if (hoveredFrame < clip.start + clip.duration && hoveredFrame > clip.start) {
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
	return foundClip;
};
