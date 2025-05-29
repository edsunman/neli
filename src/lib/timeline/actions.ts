import { appState, Clip, Source, timelineState } from '$lib/state.svelte';
import { canvasOffsetToFrame } from './utils';
import { VideoClip, VideoSource, Source as coreSource } from '@diffusionstudio/core';

export const setCurrentFrame = (frame: number) => {
	//console.log('----');
	//console.log('the frame is : ', timelineState.currentFrame);
	//console.log('setting frame to: ', frame);
	//timelineState.currentFrame = frame;
	appState.composition?.seek(frame);
};

export const setFrameFromOffset = (canvasOffset: number, width: number) => {
	timelineState.playing = false;
	setCurrentFrame(canvasOffsetToFrame(canvasOffset, width, timelineState.duration));
};

export const createSource = async (url: string) => {
	const videoSource = await coreSource.from<VideoSource>(url, { prefetch: false });
	appState.sources.push(new Source(videoSource));
};

export const createClip = async (sourceId: string) => {
	let foundSource;
	for (const source of appState.sources) {
		if (source.id === sourceId) {
			foundSource = source;
		}
	}
	if (!foundSource) return;

	const videoClip = new VideoClip(foundSource.videoSource, {
		// also accepts files/blobs or urls
		position: 'center', // ensures the clip is centered
		height: 1080 // Math.random() * 1000 // stretches the clip to the full height
	});

	await appState.composition?.add(videoClip);

	const clip = new Clip(videoClip, sourceId, foundSource.videoSource.duration?.frames ?? 0);

	timelineState.clips.push(clip);
	timelineState.invalidate = true;
};

export const moveSelectedClip = () => {
	const frame = canvasOffsetToFrame(
		timelineState.dragOffset,
		timelineState.width,
		timelineState.duration
	);
	const clip = getClipFromId(timelineState.selectedClipId);
	if (!clip) return;
	clip.start = clip.start + frame;
	clip.videoClip.offset(frame);
};

export const resizeSelctedClip = () => {
	const clip = getClipFromId(timelineState.selectedClipId);
	if (!clip) return;
	const frame = canvasOffsetToFrame(
		timelineState.dragOffset,
		timelineState.width,
		timelineState.duration
	);
	if (clip.resizeHover === 'start') {
		clip.start = clip.start + frame;
		clip.duration = clip.duration - frame;
	} else if (clip.resizeHover === 'end') {
		clip.duration = clip.duration + frame;
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
