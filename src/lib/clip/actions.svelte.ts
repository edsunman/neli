import {
	appState,
	historyManager,
	programState,
	projectManager,
	timelineState,
	workerManager
} from '$lib/state.svelte';
import { getSourceFromId } from '$lib/source/actions';
import { canvasPixelToFrame } from '$lib/timeline/utils';
import { Clip } from './clip.svelte';
import { getClipFitTransform } from './utils';
import { addTrack, setAllTrackTypes } from '$lib/timeline/actions';
import type { KeyframeTrack, Keyframe } from '$lib/types';
import { removeKeyframe } from './keyframes';

export const createClip = (
	sourceId: string,
	track = 0,
	start = 0,
	duration = 0,
	sourceOffset?: number,
	temp = false
) => {
	const source = getSourceFromId(sourceId);
	if (!source) throw new Error('Invalid source id');

	// Clip added after timeline max length
	if (start > 9000 || start < 0) return;

	if (duration === 0) {
		// No duration set so use defaults
		duration = 500;
		if (source.info.type === 'audio') {
			// assume audio and timeline is 30 fps
			duration = source.selection.out - source.selection.in;
		} else if (source.info.type === 'video') {
			// Source may have different framerate to timeline so
			// convert to seconds and back
			const inSeconds = source.selection.in / source.info.frameRate;
			// We add 1 because the out frame is inclusive
			// so we need to account for the duration of that frame
			const outSeconds = (source.selection.out + 1) / source.info.frameRate;
			const durationSeconds = outSeconds - inSeconds;
			duration = Math.round(durationSeconds * 30);
		}
	}

	if (!sourceOffset) {
		if (source.info.type === 'video') {
			const inSeconds = source.selection.in / source.info.frameRate;
			const inFrames = Math.floor(inSeconds * 30);
			sourceOffset = inFrames;
		} else if (source.info.type === 'audio') {
			sourceOffset = source.selection.in;
		} else {
			sourceOffset = 0;
		}
	}

	if (start + duration > 9000) {
		// Clip duration outside timeline bounds
		duration = 9000 - start;
	}

	const clip = new Clip(source, track, start, duration, sourceOffset);

	if (source.type === 'video' || source.type === 'image' || source.type === 'test') {
		const { scale } = getClipFitTransform(clip);
		clip.params[0] = scale;
		clip.params[1] = scale;
	}

	timelineState.clips.push(clip);
	timelineState.invalidate = true;

	if (!temp) {
		trimSiblingClips(clip);
		workerManager.sendClip(clip);
		projectManager.createClip(clip);
		historyManager.pushAction({ action: 'addClip', data: { clipId: clip.id } });
	}

	return clip;
};

export const deleteClip = (clip: Clip) => {
	clip.deleted = true;
	deselectAllClips();
	setAllTrackTypes();
	setTrackJoins(clip.track);
	historyManager.pushAction({ action: 'deleteClip', data: { clipId: clip.id } });
	workerManager.sendClip(clip);
	projectManager.updateClip(clip);
	appState.propertiesSection = 'outputAudio';
};

export const deleteClips = (clips: Clip[]) => {
	deselectAllClips();
	for (const clip of clips) {
		clip.deleted = true;
		setTrackJoins(clip.track);
		historyManager.pushAction({ action: 'deleteClip', data: { clipId: clip.id } });
	}
	workerManager.sendClip(clips);
	projectManager.updateClip(clips);
	setAllTrackTypes();
	appState.propertiesSection = 'outputAudio';
};

/** Unlike delete this will permanently remove clip and not write to history */
export const removeClip = (id: string) => {
	if (timelineState.selectedClip && timelineState.selectedClip.id === id) {
		deselectAllClips();
	}
	for (let i = timelineState.clips.length - 1; i >= 0; i--) {
		if (timelineState.clips[i].id === id) {
			timelineState.clips.splice(i, 1);
		}
	}
};

export const moveSelectedClip = (mouseY: number) => {
	const dragOffsetX = timelineState.mousePosition.x - timelineState.mouseDownPosition.x;
	const frame = canvasPixelToFrame(dragOffsetX, false);

	// multi select
	if (timelineState.selectedClips.size > 0) {
		const tracks = new Set<number>();
		for (const clip of timelineState.selectedClips) {
			clip.start = clip.savedStart + frame;
			tracks.add(clip.track);
		}

		// boundry check
		let groupStartFrame = Infinity;
		let groupEndFrame = 0;
		let firstClip: Clip | undefined;
		let lastClip: Clip | undefined;
		for (const clip of timelineState.selectedClips) {
			if (clip.start < groupStartFrame) {
				groupStartFrame = clip.start;
				firstClip = clip;
			}
			if (clip.start + clip.duration > groupEndFrame) {
				groupEndFrame = clip.start + clip.duration;
				lastClip = clip;
			}
		}
		if (groupStartFrame < 0 && firstClip) {
			for (const clip of timelineState.selectedClips) {
				const offset = clip.savedStart - firstClip.savedStart;
				clip.start = offset;
			}
		} else if (groupEndFrame > 9000 && lastClip) {
			// timeline max length 5 mins
			for (const clip of timelineState.selectedClips) {
				const offset = lastClip.savedStart - clip.savedStart;
				clip.start = 9000 - lastClip.duration - offset;
			}
		}

		for (const track of tracks) {
			setTrackJoins(track);
		}

		return;
	}

	// single select
	const clip = timelineState.selectedClip;
	if (!clip) return;

	clip.start = clip.savedStart + frame;

	if (!clip.invalid) {
		// playhead snap
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
	}

	// boundry check
	if (clip.start < 0) {
		clip.start = 0;
	}
	// timeline max length 5 mins
	if (clip.start + clip.duration > 9000) {
		clip.start = 9000 - clip.duration;
	}

	// move between tracks
	const flexHeight = timelineState.height - 35;
	const trackContainerHeight = flexHeight * 0.8;
	const currentTrack = clip.track;
	const padding = trackContainerHeight < 220 ? 0 : 5; // expand track hitbox vertically

	for (let i = 0; i < timelineState.tracks.length; i++) {
		const trackTop = timelineState.tracks[i].top - padding;
		const trackHeight = timelineState.tracks[i].height;
		const trackBottom = trackTop + trackHeight + padding * 2;

		// above track 1
		if (i === 0 && mouseY < trackTop) {
			if (timelineState.focusedTrack > 0) {
				clip.track = timelineState.focusedTrack;
				timelineState.trackDropZone = -1;
			} else if (timelineState.tracks[i].lockTop) {
				timelineState.trackDropZone = -1;
				clip.track = 1;
			} else {
				timelineState.trackDropZone = 0;
				clip.track = 0;
			}
		}
		if (timelineState.focusedTrack > 0 && timelineState.focusedTrack !== i + 1) continue;

		// on track
		if (mouseY >= trackTop && mouseY < trackBottom) {
			clip.track = i + 1;
			timelineState.trackDropZone = -1;
		}

		// below track
		if (
			mouseY > trackBottom &&
			mouseY < trackBottom + 15 &&
			timelineState.focusedTrack === 0 &&
			!timelineState.tracks[i].lockBottom
		) {
			timelineState.trackDropZone = i + 1;
			clip.track = 0;
		}
	}

	if (clip.track !== currentTrack) {
		// moved between tracks this frame
		setTrackJoins(currentTrack);
		if (clip.track > 0) {
			if (timelineState.tracks[clip.track - 1].lock) {
				clip.invalid = true;
			} else {
				clip.invalid = false;
			}
		} else {
			clip.invalid = false;
		}
	}
	setTrackJoins(clip.track);
};

export const resizeSelctedClip = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;

	const snapRange = canvasPixelToFrame(10, false);
	let minimumSize = canvasPixelToFrame(36, false);
	minimumSize = minimumSize < 5 ? 5 : minimumSize;
	clip.invalid = false;
	const dragOffsetX = timelineState.mousePosition.x - timelineState.mouseDownPosition.x;
	const frameOffset = canvasPixelToFrame(dragOffsetX, false);

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
		if ((clip.source.type === 'video' || clip.source.type === 'audio') && clip.sourceOffset < 0) {
			clip.start = clip.savedStart - clip.savedSourceOffset;
			clip.duration = clip.savedDuration + clip.savedSourceOffset;
			clip.sourceOffset = 0;
			//clip.invalid = true;
		}

		// keyframes
		const offset = clip.start - clip.savedStart;
		for (const [param, track] of clip.keyframeTracks) {
			const keyframes = track.keyframes;
			for (let i = keyframes.length - 1; i >= 0; i--) {
				const keyframe = keyframes[i];
				keyframe.frame = keyframe.savedFrame - offset;
				if (keyframe.frame < 0) {
					historyManager.pushAction({
						action: 'deleteKeyframe',
						data: {
							clipId: clip.id,
							frame: keyframe.savedFrame,
							param: param,
							value: keyframe.value,
							easeIn: keyframe.easeIn,
							easeOut: keyframe.easeOut
						}
					});
					removeKeyframe(clip, keyframe.frame, param);
				}
			}
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
		if (clip.source.info.type === 'video' || clip.source.info.type === 'audio') {
			const sourceDurationInFrames = clip.source.info.duration * 30;
			const maxLength = sourceDurationInFrames - clip.sourceOffset;

			if (clip.duration > maxLength) {
				clip.duration = maxLength;
				//clip.invalid = true;
			}
		}

		// keyframes
		for (const [param, track] of clip.keyframeTracks) {
			const keyframes = track.keyframes;
			for (let i = keyframes.length - 1; i >= 0; i--) {
				const keyframe = keyframes[i];
				if (keyframes[i].frame > clip.duration) {
					historyManager.pushAction({
						action: 'deleteKeyframe',
						data: {
							clipId: clip.id,
							frame: keyframe.savedFrame,
							param: param,
							value: keyframe.value,
							easeIn: keyframe.easeIn,
							easeOut: keyframe.easeOut
						}
					});
					removeKeyframe(clip, keyframe.frame, param);
				}
			}
		}
	}

	setTrackJoins(clip.track);
};

export const trimSiblingClips = (clip: Clip) => {
	const modifiedClips: Clip[] = [];
	for (const siblingClip of timelineState.clips) {
		if (siblingClip.id === clip.id || siblingClip.deleted || siblingClip.track !== clip.track)
			continue;
		const clipEnd = clip.start + clip.duration;
		const siblingEnd = siblingClip.start + siblingClip.duration;

		if (clip.start <= siblingClip.start && clipEnd >= siblingEnd) {
			// clip covers sibling so remove it
			siblingClip.deleted = true;
			historyManager.pushAction({
					action: 'deleteClip',
					data: {
						clipId: siblingClip.id
					}
				});
			modifiedClips.push(siblingClip);
			continue;
		}

		if (clip.start > siblingClip.start && clipEnd < siblingEnd) {
			// clip fits inside sibling so split it
			splitClip(siblingClip.id, clip.start, clip.duration);
			setTrackJoins(clip.track);
			continue;
		}

		if (clip.start > siblingClip.start && clip.start < siblingEnd) {
			// need to trim end
			const trimAmount = siblingEnd - clip.start;
			const oldDuration = siblingClip.duration;
			siblingClip.duration = siblingClip.duration - trimAmount;
			setTrackJoins(clip.track);
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
			modifiedClips.push(siblingClip);
		}
		if (clipEnd > siblingClip.start && clipEnd < siblingEnd) {
			// need to trim start
			const trimAmount = clipEnd - siblingClip.start;
			const oldStart = siblingClip.start;
			const oldDuration = siblingClip.duration;
			siblingClip.start = siblingClip.start + trimAmount;
			siblingClip.sourceOffset = siblingClip.sourceOffset + trimAmount;
			siblingClip.duration = siblingClip.duration - trimAmount;
			setTrackJoins(clip.track);
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
			modifiedClips.push(siblingClip);
		}
	}
		

	workerManager.sendClip(modifiedClips);
	projectManager.updateClip(modifiedClips);
};

export const splitClip = (clipId: string, frame: number, gapSize = 0) => {
	const clip = getClip(clipId);
	if (!clip) return;

	const oldDuration = clip.duration;
	const ogClipDuration = frame - clip.start;
	const newClipDuration = clip.duration - ogClipDuration - gapSize;
	const newClipOffset = clip.sourceOffset + ogClipDuration + gapSize;

	if (ogClipDuration < 5 || newClipDuration < 5) return;

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

	// create new clip
	const newClip = new Clip(
		clip.source,
		clip.track,
		frame + gapSize,
		newClipDuration,
		newClipOffset
	);
	newClip.params = [...clip.params];
	newClip.text = clip.text;

	// move keyframes over
	const moveAmount = frame - clip.start + gapSize;
	for (const [param, track] of clip.keyframeTracks) {
		const newTrack: KeyframeTrack = {
			keyframes: []
		};

		const framesToMove: Keyframe[] = [];
		for (let i = track.keyframes.length - 1; i >= 0; i--) {
			if (track.keyframes[i].frame > clip.duration) {
				historyManager.pushAction({
					action: 'deleteKeyframe',
					data: {
						clipId: clip.id,
						frame: track.keyframes[i].frame,
						param: param,
						value: track.keyframes[i].value,
						easeIn: track.keyframes[i].easeIn,
						easeOut: track.keyframes[i].easeOut
					}
				});
				const keyframe = removeKeyframe(clip, track.keyframes[i].frame, param);
				keyframe.frame = keyframe.frame - moveAmount;
				framesToMove.push(keyframe);
			}
		}
		newTrack.keyframes = framesToMove.reverse();
		newClip.keyframeTracks.set(param, newTrack);
		newClip.keyframeTracksActive.push(param);
	}

	timelineState.clips.push(newClip);
	workerManager.sendClip([clip, newClip]);
	projectManager.createClip(newClip);
	projectManager.updateClip(clip);
	historyManager.pushAction({ action: 'addClip', data: { clipId: newClip.id } });
	setTrackJoins(newClip.track);
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
	// NOTE: this runs every frame on mouse move so may be bad news
	// with large numbers of clips. Hashmap may be better?
	let foundClip;
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		clip.hovered = false;
		for (let i = 0; i < timelineState.tracks.length; i++) {
			if (timelineState.focusedTrack > 0 && timelineState.focusedTrack !== i + 1) {
				continue;
			}
			if (
				offsetY > timelineState.tracks[i].top &&
				offsetY < timelineState.tracks[i].top + timelineState.tracks[i].height &&
				clip.track === i + 1
			) {
				// hovered over  track
				if (hoveredFrame < clip.start + clip.duration && hoveredFrame >= clip.start) {
					// hovered over clip
					foundClip = clip;
					clip.hovered = true;
				}
				break;
			}
		}
	}

	return foundClip;
};

export const splitHoveredClip = (hoveredFrame: number, offsetY: number) => {
	let foundClip;
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		clip.hovered = false;
		for (let i = 0; i < timelineState.tracks.length; i++) {
			if (
				offsetY > timelineState.tracks[i].top &&
				offsetY < timelineState.tracks[i].top + timelineState.tracks[i].height &&
				clip.track === i + 1
			) {
				if (hoveredFrame < clip.start + clip.duration && hoveredFrame >= clip.start) {
					foundClip = clip;
				}
				break;
			}
		}
	}
	if (foundClip) splitClip(foundClip.id, hoveredFrame);
};

export const multiSelectClip = (clipId: string) => {
	const clip = getClip(clipId);
	if (!clip) return;

	if (timelineState.selectedClip) {
		const selected = timelineState.selectedClip;
		deselectAllClips();
		timelineState.selectedClips.add(selected);
		timelineState.selectedClips.add(clip);
	} else {
		timelineState.selectedClips.add(clip);
	}
	timelineState.invalidate = true;
};

export const multiSelectClipsInRange = () => {
	timelineState.selectedClips.clear();
	const dragOffsetY = timelineState.mousePosition.y - timelineState.mouseDownPosition.y;
	const dragOffsetX = timelineState.mousePosition.x - timelineState.mouseDownPosition.x;
	const startTop = Math.min(
		timelineState.mouseDownPosition.y,
		timelineState.mouseDownPosition.y + dragOffsetY
	);
	const endTop = Math.max(
		timelineState.mouseDownPosition.y,
		timelineState.mouseDownPosition.y + dragOffsetY
	);
	const tracks = new Set<number>();
	for (let i = 0; i < timelineState.tracks.length; i++) {
		if (timelineState.focusedTrack > 0 && timelineState.focusedTrack !== i + 1) continue;
		if (
			startTop < timelineState.tracks[i].top + timelineState.tracks[i].height &&
			endTop > timelineState.tracks[i].top
		) {
			tracks.add(i + 1);
		}
	}

	const startFrame = canvasPixelToFrame(timelineState.mouseDownPosition.x);
	const endFrame = canvasPixelToFrame(timelineState.mouseDownPosition.x + dragOffsetX);
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (
			clip.start <= Math.max(startFrame, endFrame) &&
			clip.start + clip.duration > Math.min(startFrame, endFrame) &&
			tracks.has(clip.track)
		) {
			timelineState.selectedClips.add(clip);
		}
	}
};

/** Call when clip is "dropped" to persist clip state to worker, history and project DB */
export const finaliseClip = (
	clip: Clip,
	action: 'trimClip' | 'moveClip' | 'addClip',
	updateWorker = true
) => {
	// revert state for invalid clips
	if (action === 'moveClip' && clip.invalid) {
		clip.track = clip.savedTrack;
		clip.start = clip.savedStart;
		clip.invalid = false;
		setTrackJoins(clip.track);
		return;
	}
	if (action === 'addClip' && clip.invalid) {
		setTrackJoins(clip.track);
		removeClip(clip.id);
		return;
	}

	clip.temp = false;
	trimSiblingClips(clip);

	if (timelineState.trackDropZone > -1) {
		addTrack(timelineState.trackDropZone);
		clip.track = timelineState.trackDropZone + 1;
		timelineState.trackDropZone = -1;
	}

	if (updateWorker) {
		workerManager.sendClip(clip);
		projectManager.updateClip(clip);
	}

	if (action === 'moveClip' && (clip.start !== clip.savedStart || clip.track !== clip.savedTrack)) {
		historyManager.pushAction({
			action: 'moveClip',
			data: {
				clipId: clip.id,
				newStart: clip.start,
				oldStart: clip.savedStart,
				newTrack: clip.track,
				oldTrack: clip.savedTrack
			}
		});
	}
	if (
		action === 'trimClip' &&
		(clip.start !== clip.savedStart || clip.duration !== clip.savedDuration)
	) {
		historyManager.pushAction({
			action: 'trimClip',
			data: {
				clipId: clip.id,
				newStart: clip.start,
				oldStart: clip.savedStart,
				newDuration: clip.duration,
				oldDuration: clip.savedDuration
			}
		});
	}
	if (action === 'addClip') {
		historyManager.pushAction({
			action: 'addClip',
			data: { clipId: clip.id }
		});
	}
};

export const deselectClipIfTooSmall = () => {
	if (!timelineState.selectedClip) return;
	const minimumSize = canvasPixelToFrame(35, false);
	if (timelineState.selectedClip.duration < minimumSize) deselectAllClips();
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

export const setTrackJoins = (track: number) => {
	const startPoints = new Set();
	const endPoints = new Set();
	for (const clip of timelineState.clips) {
		if (clip.track !== track || clip.deleted || clip.invalid) continue;
		clip.joinLeft = false;
		clip.joinRight = false;
		startPoints.add(clip.start);
		endPoints.add(clip.start + clip.duration);
	}
	for (const clip of timelineState.clips) {
		if (clip.track !== track || clip.deleted || clip.invalid) continue;
		if (endPoints.has(clip.start)) clip.joinLeft = true;
		if (startPoints.has(clip.start + clip.duration)) clip.joinRight = true;
	}
};

export const setAllJoins = () => {
	for (let i = 1; i <= timelineState.tracks.length; i++) {
		setTrackJoins(i);
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

export const getClipsAtFrame = (frameNumber: number) => {
	const clips = [];
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			clips.push(clip);
		}
	}
	clips.sort((a, b) => a.track - b.track);
	return clips;
};

export const deselectAllClips = (showOutputAudio = true) => {
	programState.selectedClip = null;
	timelineState.selectedClip = null;
	timelineState.selectedClips.clear();
	if (showOutputAudio) appState.propertiesSection = 'outputAudio';
};

export const cloneClipProperties = (clip:Clip, destinationClip:Clip) => {
	destinationClip.params = $state.snapshot(clip.params);
	destinationClip.keyframeTracks = structuredClone(clip.keyframeTracks);
	destinationClip.keyframeTracksActive = [...clip.keyframeTracksActive];
}
