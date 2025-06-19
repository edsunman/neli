import { appHistory, timelineState } from '$lib/state.svelte';
import { getSourceFromId } from '$lib/source/actions';
import { canvasPixelToFrame } from '$lib/timeline/utils';
import { Clip } from './clip';
import { updateWorkerClip } from '$lib/renderer/actions';

export const createClip = async (
	sourceId: string,
	track: number,
	start = 0,
	duration = 0,
	sourceOffset = 0
) => {
	const source = getSourceFromId(sourceId);
	if (!source) return;

	const clip = new Clip(source, track, start, duration ? duration : source.duration, sourceOffset);
	timelineState.clips.push(clip);
	timelineState.invalidate = true;

	updateWorkerClip(clip);
	appHistory.newCommand({ action: 'addClip', data: { clipId: clip.id } });
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
		if (clip.id === siblingClip.id || siblingClip.deleted /* || siblingClip.track !== clip.track */)
			continue;

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
			if (clip.id === siblingClip.id || siblingClip.deleted || siblingClip.track !== clip.track)
				continue;
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

		const maxLength = clip.source.duration ? clip.source.duration - clip.sourceOffset : 1000;

		//  sibling clips snap
		let neighbour;
		let prevDistance = 10000;
		for (const siblingClip of timelineState.clips) {
			if (clip.id === siblingClip.id || siblingClip.deleted || siblingClip.track !== clip.track)
				continue;
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
		if (siblingClip.id === clip.id || siblingClip.deleted || siblingClip.track !== clip.track)
			continue;
		const clipEnd = clip.start + clip.duration;
		const siblingEnd = siblingClip.start + siblingClip.duration;

		if (clip.start < siblingClip.start && clipEnd > siblingEnd) {
			// clip covers sibling so remove it
			clipsToRemove.push(siblingClip.id);
			continue;
		}

		if (clip.start > siblingClip.start && clipEnd < siblingEnd) {
			// clip fits inside sibling so split it
			splitClip(siblingClip.id, clip.start, clip.duration);
			continue;
		}

		if (clip.start > siblingClip.start && clip.start < siblingEnd) {
			// need to trim end
			const trimAmount = siblingEnd - clip.start;
			siblingClip.duration = siblingClip.duration - trimAmount;
		}
		if (clipEnd > siblingClip.start && clipEnd < siblingEnd) {
			// need to trim start
			const trimAmount = clipEnd - siblingClip.start;
			siblingClip.start = siblingClip.start + trimAmount;
			siblingClip.sourceOffset = siblingClip.sourceOffset + trimAmount;
			siblingClip.duration = siblingClip.duration - trimAmount;
		}
	}
	for (const clipId of clipsToRemove) {
		deleteClip(clipId);
	}
};

export const splitClip = (clipId: string, frame: number, gapSize = 0) => {
	const clip = getClip(clipId);
	if (!clip) return;

	const ogClipDuration = frame - clip.start;
	const newClipDuration = clip.duration - ogClipDuration - gapSize;
	const newClipOffset = clip.sourceOffset + ogClipDuration + gapSize;

	// trim clip
	clip.duration = ogClipDuration;

	// create new clip
	createClip(clip.source.id, clip.track, frame + gapSize, newClipDuration, newClipOffset);
};

export const deleteClip = (id: string, unDelete = false, noHistory = false) => {
	for (const clip of timelineState.clips) {
		if (clip.id === id) {
			clip.deleted = unDelete ? false : true;
			//clip.videoClip.disabled = unDelete ? false : true;
			timelineState.selectedClip = null;
			if (!noHistory) appHistory.newCommand({ action: 'deleteClip', data: { clipId: clip.id } });
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
		if (clip.deleted) continue;
		clip.hovered = false;
		if (
			(offsetY > 100 && offsetY < 135 && clip.track === 1) ||
			(offsetY > 150 && offsetY < 185 && clip.track === 2) ||
			(offsetY > 200 && offsetY < 235 && clip.track === 3)
		) {
			if (hoveredFrame < clip.start + clip.duration && hoveredFrame >= clip.start) {
				foundClip = clip;
				clip.hovered = true;
				timelineState.hoverClipId = clip.id;
			}
		}
	}
	return foundClip;
};

export const getClip = (id: string) => {
	let foundClip;
	for (const clip of timelineState.clips) {
		if (clip.id === id) {
			foundClip = clip;
			break;
		}
	}
	return foundClip ?? null;
};
