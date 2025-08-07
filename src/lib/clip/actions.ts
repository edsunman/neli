import { historyManager, timelineState } from '$lib/state.svelte';
import { getSourceFromId } from '$lib/source/actions';
import { canvasPixelToFrame } from '$lib/timeline/utils';
import { Clip } from './clip.svelte';
import { updateWorkerClip } from '$lib/worker/actions.svelte';

export const createClip = (
	sourceId: string,
	track: number,
	start = 0,
	duration = 0,
	sourceOffset = 0
) => {
	const source = getSourceFromId(sourceId);
	if (!source) return;

	if (duration === 0) {
		// no duration set so use defaults
		duration = 500;
		if (source.duration) duration = source.duration;
	}

	const clip = new Clip(source, track, start, duration, sourceOffset);
	timelineState.clips.push(clip);
	timelineState.invalidate = true;

	updateWorkerClip(clip);
	historyManager.newCommand({ action: 'addClip', data: { clipId: clip.id } });

	return clip;
};

export const deleteClip = (id: string) => {
	for (const clip of timelineState.clips) {
		if (clip.id === id) {
			clip.deleted = true;
			timelineState.selectedClip = null;
			setClipJoins(clip);
			historyManager.newCommand({ action: 'deleteClip', data: { clipId: clip.id } });
			updateWorkerClip(clip);
		}
	}
};

export const moveSelectedClip = (mouseY: number) => {
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

	// move between tracks
	if (clip.source.type === 'video' || clip.source.type === 'test') {
		if (mouseY > 192) {
			clip.track = 3;
		} else {
			clip.track = 2;
		}
	}

	setClipJoins(clip);
};

export const resizeSelctedClip = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;

	const snapRange = canvasPixelToFrame(10, false);
	let minimumSize = canvasPixelToFrame(35, false);
	minimumSize = minimumSize < 1 ? 1 : minimumSize;
	clip.invalid = false;
	const frameOffset = canvasPixelToFrame(timelineState.dragOffset, false);

	if (clip.resizeHover === 'start') {
		clip.start = clip.savedStart + frameOffset;
		clip.duration = clip.savedDuration - frameOffset;
		clip.sourceOffset = clip.savedSourceOffset + frameOffset;

		// playhead snap
		if (isFrameInSnapRange(clip.start, timelineState.currentFrame, snapRange)) {
			clip.start = timelineState.currentFrame;
			const delta = clip.savedStart - clip.start;
			clip.duration = clip.savedDuration + delta;
			clip.sourceOffset = clip.savedSourceOffset - delta;
		}

		const leftSibling = getLeftSibling(clip);
		const hardStop = leftSibling ? leftSibling.start + leftSibling.duration : 0;

		// boundry check
		if (clip.start < hardStop) {
			clip.start = hardStop;
			const delta = clip.savedStart - clip.start;
			clip.duration = clip.savedDuration + delta;
			clip.sourceOffset = clip.savedSourceOffset - delta;
		}

		// min size check
		if (clip.duration < minimumSize) {
			clip.start = clip.savedStart + clip.savedDuration - minimumSize;
			clip.duration = minimumSize;
			clip.sourceOffset = clip.savedSourceOffset + clip.savedDuration - minimumSize;
		}

		// source length checks
		if (clip.source.duration && clip.sourceOffset < 0) {
			clip.start = clip.savedStart - clip.savedSourceOffset;
			clip.duration = clip.savedDuration + clip.savedSourceOffset;
			clip.sourceOffset = 0;
			clip.invalid = true;
		}
	} else if (clip.resizeHover === 'end') {
		clip.duration = clip.savedDuration + frameOffset;

		// playhead snap
		if (isFrameInSnapRange(clip.start + clip.duration, timelineState.currentFrame, snapRange)) {
			clip.duration = timelineState.currentFrame - clip.start;
		}

		const maxLength = clip.source.duration ? clip.source.duration - clip.sourceOffset : 1000;
		const rightSibling = getRightSibling(clip);
		const hardStop = rightSibling ? rightSibling.start : timelineState.duration;

		// boundry check
		if (clip.start + clip.duration > hardStop) {
			clip.duration = hardStop - clip.start;
		}

		// min size check
		if (clip.duration < minimumSize) {
			clip.duration = minimumSize;
		}

		// source length checks
		if (clip.source.duration && clip.duration > maxLength) {
			clip.duration = maxLength;
			clip.invalid = true;
		}
	}

	setClipJoins(clip);
};

export const trimSiblingClips = (clip: Clip) => {
	const clipsToRemove: Clip[] = [];
	for (const siblingClip of timelineState.clips) {
		if (siblingClip.id === clip.id || siblingClip.deleted || siblingClip.track !== clip.track)
			continue;
		const clipEnd = clip.start + clip.duration;
		const siblingEnd = siblingClip.start + siblingClip.duration;

		if (clip.start < siblingClip.start && clipEnd > siblingEnd) {
			// clip covers sibling so remove it
			clipsToRemove.push(siblingClip);
			continue;
		}

		if (clip.start > siblingClip.start && clipEnd < siblingEnd) {
			// clip fits inside sibling so split it
			splitClip(siblingClip.id, clip.start, clip.duration);
			setClipJoins(clip);
			continue;
		}

		if (clip.start > siblingClip.start && clip.start < siblingEnd) {
			// need to trim end
			const trimAmount = siblingEnd - clip.start;
			const oldDuration = siblingClip.duration;
			siblingClip.duration = siblingClip.duration - trimAmount;
			setClipJoins(clip);
			updateWorkerClip(siblingClip);
			historyManager.pushAction({
				action: 'trimClip',
				data: {
					clipId: siblingClip.id,
					newStart: siblingClip.start,
					oldStart: siblingClip.start,
					newDuration: siblingClip.duration,
					oldDuration: oldDuration
				}
			});
		}
		if (clipEnd > siblingClip.start && clipEnd < siblingEnd) {
			// need to trim start
			const trimAmount = clipEnd - siblingClip.start;
			const oldStart = siblingClip.start;
			const oldDuration = siblingClip.duration;
			siblingClip.start = siblingClip.start + trimAmount;
			siblingClip.sourceOffset = siblingClip.sourceOffset + trimAmount;
			siblingClip.duration = siblingClip.duration - trimAmount;
			setClipJoins(clip);
			updateWorkerClip(siblingClip);
			historyManager.pushAction({
				action: 'trimClip',
				data: {
					clipId: siblingClip.id,
					newStart: siblingClip.start,
					oldStart: oldStart,
					newDuration: siblingClip.duration,
					oldDuration: oldDuration
				}
			});
		}
	}

	for (const clip of clipsToRemove) {
		clip.deleted = true;
		historyManager.pushAction({
			action: 'deleteClip',
			data: {
				clipId: clip.id
			}
		});
		updateWorkerClip(clip);
	}
};

export const splitClip = (clipId: string, frame: number, gapSize = 0) => {
	const clip = getClip(clipId);
	if (!clip) return;

	const oldDuration = clip.duration;
	const ogClipDuration = frame - clip.start;
	const newClipDuration = clip.duration - ogClipDuration - gapSize;
	const newClipOffset = clip.sourceOffset + ogClipDuration + gapSize;

	// trim clip
	clip.duration = ogClipDuration;
	historyManager.pushAction({
		action: 'trimClip',
		data: {
			clipId: clip.id,
			newStart: clip.start,
			oldStart: clip.start,
			newDuration: clip.duration,
			oldDuration: oldDuration
		}
	});
	updateWorkerClip(clip);

	// create new clip
	const newClip = new Clip(
		clip.source,
		clip.track,
		frame + gapSize,
		newClipDuration,
		newClipOffset
	);
	newClip.params = [...clip.params];
	timelineState.clips.push(newClip);
	updateWorkerClip(newClip);
	historyManager.pushAction({ action: 'addClip', data: { clipId: newClip.id } });
	setClipJoins(newClip);
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
	const minimumSize = canvasPixelToFrame(35, false);
	for (const clip of timelineState.clips) {
		if (clip.deleted || clip.duration < minimumSize) continue;
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

export const deselectClipIfTooSmall = () => {
	if (!timelineState.selectedClip) return;
	const minimumSize = canvasPixelToFrame(35, false);
	if (timelineState.selectedClip.duration < minimumSize) timelineState.selectedClip = null;
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

const isFrameInSnapRange = (frame: number, targetFrame: number, snapRange: number) => {
	if (frame < targetFrame + snapRange && frame > targetFrame - snapRange) {
		return true;
	}
	return false;
};

export const setClipJoins = (clip: Clip) => {
	clip.joinLeft = false;
	clip.joinRight = false;

	const leftSibling = getLeftSibling(clip);
	if (leftSibling) {
		leftSibling.joinRight = false;
		if (leftSibling.start + leftSibling.duration === clip.start && !clip.deleted) {
			// joined!
			clip.joinLeft = true;
			leftSibling.joinRight = true;
		}
	}

	const rightSibling = getRightSibling(clip);
	if (rightSibling) {
		rightSibling.joinLeft = false;
		if (rightSibling.start === clip.start + clip.duration && !clip.deleted) {
			// joined!
			clip.joinRight = true;
			rightSibling.joinLeft = true;
		}
	}
};

const getLeftSibling = (clip: Clip) => {
	let sibling;
	let previousDistance = Infinity;
	for (const siblingClip of timelineState.clips) {
		if (
			siblingClip.id === clip.id ||
			siblingClip.deleted ||
			siblingClip.track !== clip.track ||
			siblingClip.start + siblingClip.duration > clip.start + clip.duration
		)
			continue;
		const distance = clip.start + clip.duration - (siblingClip.start + siblingClip.duration);
		if (distance < previousDistance) {
			sibling = siblingClip;
			previousDistance = distance;
		}
	}
	return sibling;
};

const getRightSibling = (clip: Clip) => {
	let sibling;
	let previousDistance = Infinity;
	for (const siblingClip of timelineState.clips) {
		if (
			siblingClip.id === clip.id ||
			siblingClip.deleted ||
			siblingClip.track !== clip.track ||
			siblingClip.start < clip.start
		)
			continue;

		const distance = siblingClip.start - clip.start;
		if (distance < previousDistance) {
			sibling = siblingClip;
			previousDistance = distance;
		}
	}
	return sibling;
};
