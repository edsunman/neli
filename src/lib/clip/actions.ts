import { appState, timelineState } from '$lib/state.svelte';
import { getSourceFromId } from '$lib/timeline/actions';
import { canvasPixelToFrame } from '$lib/timeline/utils';
import { VideoClip } from '@diffusionstudio/core';
import { Clip } from './clip';

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

	// timeline snap
	const snapRange = canvasPixelToFrame(10, false);
	if (isFrameInSnapRange(clip.start, timelineState.currentFrame, snapRange)) {
		clip.start = timelineState.currentFrame;
	}
	if (isFrameInSnapRange(clip.start + clip.duration, timelineState.currentFrame, snapRange)) {
		clip.start = timelineState.currentFrame - clip.duration;
	}

	// sibling clips snap
	for (const siblingClip of timelineState.clips) {
		if (clip.id === siblingClip.id) continue;
		if (isFrameInSnapRange(clip.start, siblingClip.start + siblingClip.duration, snapRange)) {
			clip.start = siblingClip.start + siblingClip.duration;
		}
		if (isFrameInSnapRange(clip.start + clip.duration, siblingClip.start, snapRange)) {
			clip.start = siblingClip.start - clip.duration;
		}
	}

	// boundry check
	if (clip.start < 0) {
		clip.start = 0;
	}
	if (clip.start + clip.duration > timelineState.duration) {
		clip.start = timelineState.duration - clip.duration;
	}
};

const isFrameInSnapRange = (frame: number, targetFrame: number, snapRange: number) => {
	if (frame < targetFrame + snapRange && frame > targetFrame - snapRange) {
		return true;
	}
	return false;
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

		// timeline snap
		const snapRange = canvasPixelToFrame(10, false);
		if (isFrameInSnapRange(clip.start, timelineState.currentFrame, snapRange)) {
			clip.start = timelineState.currentFrame;
			const delta = clip.savedStart - clip.start;
			clip.duration = clip.savedDuration + delta;
			clip.sourceOffset = clip.savedSourceOffset - delta;
		}

		//  sibling clips snap
		let neighbour;
		let prevDistance = 10000;
		for (const siblingClip of timelineState.clips) {
			if (clip.id === siblingClip.id) continue;
			const distance = clip.start + clip.duration - (siblingClip.start + siblingClip.duration);
			if (distance < 0 || distance > clip.sourceOffset + clip.duration) continue;
			if (distance < prevDistance) {
				neighbour = siblingClip;
				prevDistance = distance;
			}
		}

		const hardStop = neighbour ? neighbour.start + neighbour.duration : 0;

		// boundry check
		if (clip.start < hardStop) {
			clip.start = hardStop;
			const delta = clip.savedStart - clip.start;
			clip.duration = clip.savedDuration + delta;
			clip.sourceOffset = clip.savedSourceOffset - delta;
			return;
		}

		// source length checks
		if (clip.sourceOffset < 0) {
			clip.start = clip.savedStart - clip.savedSourceOffset;
			clip.duration = clip.savedDuration + clip.savedSourceOffset;
			clip.sourceOffset = 0;
			clip.invalid = true;
		} else if (clip.duration < 200) {
			clip.start = clip.savedStart + clip.savedDuration - 200;
			clip.duration = 200;
			clip.sourceOffset = clip.savedSourceOffset + clip.savedDuration - 200;
		}
	} else if (clip.resizeHover === 'end') {
		clip.duration = clip.savedDuration + frameOffset;

		// timeline snap
		const snapRange = canvasPixelToFrame(10, false);
		if (isFrameInSnapRange(clip.start + clip.duration, timelineState.currentFrame, snapRange)) {
			clip.duration = timelineState.currentFrame - clip.start;
		}

		const maxLength = clip.source.duration - clip.sourceOffset;

		//  sibling clips snap
		let neighbour;
		let prevDistance = 10000;
		for (const siblingClip of timelineState.clips) {
			if (clip.id === siblingClip.id) continue;
			const distance = siblingClip.start - clip.start;
			if (distance < 0 || distance > maxLength) continue;
			if (distance < prevDistance) {
				neighbour = siblingClip;
				prevDistance = distance;
			}
		}

		const hardStop = neighbour ? neighbour.start : timelineState.duration;

		// boundry check
		if (clip.start + clip.duration > hardStop) {
			clip.duration = hardStop - clip.start;
			return;
		}

		// source length checks
		if (clip.duration > maxLength) {
			clip.duration = maxLength;
			clip.invalid = true;
		} else if (clip.duration < 200) {
			clip.duration = 200;
		}
	}
};

export const trimSiblingClips = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const clipsToRemove: string[] = [];
	for (const siblingClip of timelineState.clips) {
		if (siblingClip.id === clip.id) continue;
		const clipEnd = clip.start + clip.duration;
		const siblingEnd = siblingClip.start + siblingClip.duration;

		if (clip.start < siblingClip.start && clipEnd > siblingEnd) {
			// clip covers sibling so remove it
			clipsToRemove.push(siblingClip.id);
			continue;
		}

		if (clip.start > siblingClip.start && clip.start < siblingEnd) {
			// need to trim end
			const trimAmount = siblingEnd - clip.start;
			siblingClip.duration = siblingClip.duration - trimAmount;
			siblingClip.videoClip.trim(siblingClip.start, siblingClip.start + siblingClip.duration);
		}
		if (clipEnd > siblingClip.start && clipEnd < siblingEnd) {
			// need to trim start
			const trimAmount = clipEnd - siblingClip.start;
			siblingClip.start = siblingClip.start + trimAmount;
			siblingClip.sourceOffset = siblingClip.sourceOffset + trimAmount;
			siblingClip.duration = siblingClip.duration - trimAmount;
			siblingClip.videoClip.trim(siblingClip.start, siblingClip.start + siblingClip.duration);
		}
	}
	for (const clipId of clipsToRemove) {
		removeClipWithId(clipId);
	}
};

export const removeClipWithId = (id: string) => {
	let i = 0;
	while (i < timelineState.clips.length) {
		const clip = timelineState.clips[i];
		if (clip.id === id) {
			console.log(clip.videoClip);
			clip.videoClip.detach();

			timelineState.clips.splice(i, 1);
		} else {
			i += 1;
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

export const setHoverOnHoveredClip = (hoveredFrame: number, offsetY: number) => {
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
