import { historyManager, timelineState } from '$lib/state.svelte';
import { getSourceFromId } from '$lib/source/actions';
import { canvasPixelToFrame } from '$lib/timeline/utils';
import { Clip } from './clip.svelte';
import { updateWorkerClip } from '$lib/worker/actions.svelte';

export const createClip = (
	sourceId: string,
	track = 0,
	start = 0,
	duration = 0,
	sourceOffset = 0,
	temp = false
) => {
	const source = getSourceFromId(sourceId);
	if (!source) return;

	if (duration === 0) {
		// no duration set so use defaults
		duration = 500;
		if (source.duration) {
			if (source.frameRate && source.frameRate !== 30) {
				const ratio = 30 / source.frameRate;
				duration = Math.floor(source.duration * ratio);
			} else {
				duration = source.duration;
			}
		}
	}

	if (start + duration > timelineState.duration) {
		// clip outside timeline bounds
		duration = timelineState.duration - start;
	}

	if (track < 1) {
		if (source.type === 'text') track = 1;
		if (source.type === 'test' || source.type === 'video') track = 2;
		if (source.type === 'audio') track = 4;
	}

	const clip = new Clip(source, track, start, duration, sourceOffset);
	timelineState.clips.push(clip);
	timelineState.invalidate = true;

	if (!temp) {
		trimSiblingClips(clip);
		updateWorkerClip(clip);
		//historyManager.newCommand({ action: 'addClip', data: { clipId: clip.id } });
		historyManager.pushAction({ action: 'addClip', data: { clipId: clip.id } });
		timelineState.selectedClip = clip;
	}

	return clip;
};

export const deleteClip = (id: string) => {
	for (const clip of timelineState.clips) {
		if (clip.id === id) {
			clip.deleted = true;
			timelineState.selectedClip = null;
			setTrackClipJoins(clip.track);
			historyManager.newCommand({ action: 'deleteClip', data: { clipId: clip.id } });
			updateWorkerClip(clip);
		}
	}
};

/** Unlike delete this will permanently remove clip and not write to history */
export const removeClip = (id: string) => {
	if (timelineState.selectedClip && timelineState.selectedClip.id === id) {
		timelineState.selectedClip = null;
	}
	for (let i = timelineState.clips.length - 1; i >= 0; i--) {
		if (timelineState.clips[i].id === id) {
			timelineState.clips.splice(i, 1);
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
		const clipEnd = clip.start + clip.duration;
		const siblingClipEnd = siblingClip.start + siblingClip.duration;

		if (clip.id === siblingClip.id || siblingClip.deleted) continue;
		// check start to end
		if (isFrameInSnapRange(clip.start, siblingClipEnd, snapRange)) {
			clip.start = siblingClipEnd;
		}
		// check end to start
		if (isFrameInSnapRange(clipEnd, siblingClip.start, snapRange)) {
			clip.start = siblingClip.start - clip.duration;
		}
		if (clip.track !== siblingClip.track) {
			// check end to end
			if (isFrameInSnapRange(clipEnd, siblingClipEnd, snapRange)) {
				clip.start = siblingClipEnd - clip.duration;
			}
			// check start to start
			if (isFrameInSnapRange(clip.start, siblingClip.start, snapRange)) {
				clip.start = siblingClip.start;
			}
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
		const currentTrack = clip.track;
		if (mouseY > timelineState.trackTops[2] - 5) {
			clip.track = 3;
		} else {
			clip.track = 2;
		}
		if (clip.track !== currentTrack) {
			// moved between tracks this frame
			setTrackClipJoins(currentTrack);
		}
	}
	setTrackClipJoins(clip.track);
	//setClipJoins(clip);
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
		if (clip.source.duration) {
			let maxLength = clip.source.duration - clip.sourceOffset;
			if (clip.source.frameRate && clip.source.frameRate !== 30) {
				const ratio = 30 / clip.source.frameRate;
				maxLength = Math.floor(clip.source.duration * ratio - clip.sourceOffset);
			}

			if (clip.duration > maxLength) {
				clip.duration = maxLength;
				clip.invalid = true;
			}
		}
	}

	setTrackClipJoins(clip.track);
};

export const trimSiblingClips = (clip: Clip) => {
	const clipsToRemove: Clip[] = [];
	for (const siblingClip of timelineState.clips) {
		if (siblingClip.id === clip.id || siblingClip.deleted || siblingClip.track !== clip.track)
			continue;
		const clipEnd = clip.start + clip.duration;
		const siblingEnd = siblingClip.start + siblingClip.duration;

		if (clip.start <= siblingClip.start && clipEnd >= siblingEnd) {
			// clip covers sibling so remove it
			clipsToRemove.push(siblingClip);
			continue;
		}

		if (clip.start > siblingClip.start && clipEnd < siblingEnd) {
			// clip fits inside sibling so split it
			splitClip(siblingClip.id, clip.start, clip.duration);
			setTrackClipJoins(clip.track);
			continue;
		}

		if (clip.start > siblingClip.start && clip.start < siblingEnd) {
			// need to trim end
			const trimAmount = siblingEnd - clip.start;
			const oldDuration = siblingClip.duration;
			siblingClip.duration = siblingClip.duration - trimAmount;
			setTrackClipJoins(clip.track);
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
			setTrackClipJoins(clip.track);
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
	setTrackClipJoins(newClip.track);
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
			(offsetY > timelineState.trackTops[0] &&
				offsetY < timelineState.trackTops[0] + timelineState.trackHeights[0] &&
				clip.track === 1) ||
			(offsetY > timelineState.trackTops[1] &&
				offsetY < timelineState.trackTops[1] + timelineState.trackHeights[1] &&
				clip.track === 2) ||
			(offsetY > timelineState.trackTops[2] &&
				offsetY < timelineState.trackTops[2] + timelineState.trackHeights[2] &&
				clip.track === 3)
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

export const setTrackClipJoins = (track: number) => {
	const startPoints = new Set();
	const endPoints = new Set();
	for (const clip of timelineState.clips) {
		if (clip.track !== track || clip.deleted) continue;
		clip.joinLeft = false;
		clip.joinRight = false;
		startPoints.add(clip.start);
		endPoints.add(clip.start + clip.duration);
	}
	for (const clip of timelineState.clips) {
		if (clip.track !== track || clip.deleted) continue;
		if (endPoints.has(clip.start)) clip.joinLeft = true;
		if (startPoints.has(clip.start + clip.duration)) clip.joinRight = true;
	}
};

export const setAllJoins = () => {
	for (let i = 1; i <= 4; i++) {
		setTrackClipJoins(i);
	}
};

const getLeftSibling = (clip: Clip, trackNumber = 0) => {
	let sibling;
	let previousDistance = Infinity;
	const trackToCheck = trackNumber > 0 ? trackNumber : clip.track;
	for (const siblingClip of timelineState.clips) {
		if (
			siblingClip.id === clip.id ||
			siblingClip.deleted ||
			siblingClip.track !== trackToCheck ||
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

const getRightSibling = (clip: Clip, trackNumber = 0) => {
	let sibling;
	let previousDistance = Infinity;
	const trackToCheck = trackNumber > 0 ? trackNumber : clip.track;
	for (const siblingClip of timelineState.clips) {
		if (
			siblingClip.id === clip.id ||
			siblingClip.deleted ||
			siblingClip.track !== trackToCheck ||
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
