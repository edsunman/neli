import { appState, historyManager, timelineState, workerManager } from '$lib/state.svelte';
import type { Clip } from './clip.svelte';
import { getKeyframePositionHelpers } from './utils';

export const createOrUpdateKeyframe = (paramIndices: number[]) => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const clipFrame = timelineState.currentFrame - clip.start;
	appState.selectedKeyframeParam = paramIndices[0];

	for (const paramIndex of paramIndices) {
		const track = clip.keyframeTracks.get(paramIndex);
		const keyframeIndex = track?.frames.findIndex((f) => clipFrame === f);
		if (!track || (typeof keyframeIndex !== 'undefined' && keyframeIndex < 0)) {
			addKeyframe(clip, clipFrame, paramIndex, clip.params[paramIndex]);
			historyManager.pushAction({
				action: 'addKeyframe',
				data: {
					clipId: clip.id,
					frame: clipFrame,
					param: paramIndex,
					value: clip.params[paramIndex],
					easeIn: 1,
					easeOut: 1
				}
			});
			continue;
		} else if (typeof keyframeIndex !== 'undefined') {
			// need to update
			track.values[keyframeIndex] = clip.params[paramIndex];
			console.log('updating');
		}
	}

	workerManager.sendClip(clip);
};

export const addKeyframe = (
	clip: Clip,
	frame: number,
	param: number,
	value: number,
	easeIn = 1,
	easeOut = 1
) => {
	// Create track if it does not exist
	let track = clip.keyframeTracks.get(param);
	if (!track) {
		track = {
			frames: [frame],
			savedFrames: [frame],
			values: [value],
			easeIn: [easeIn],
			easeOut: [easeOut]
		};
		clip.keyframeTracksActive.push(param);
		clip.keyframeTracks.set(param, track);
		return;
	}

	let insertIndex = 0;
	while (insertIndex < track.frames.length && track.frames[insertIndex] < frame) {
		insertIndex++;
	}

	if (track.frames[insertIndex] === frame) {
		throw new Error('Keyframe already exists for this frame');
	} else {
		track.frames.splice(insertIndex, 0, frame);
		track.values.splice(insertIndex, 0, value);
		track.savedFrames.splice(insertIndex, 0, value);
		track.easeIn.splice(insertIndex, 0, easeIn);
		track.easeOut.splice(insertIndex, 0, easeOut);
		clip.keyframesOnThisFrame.push(param);
		console.log('adding');
	}
};

export const updateKeyframeEasing = (
	keyframeIndex: number,
	easing: number,
	inOrOut: 'in' | 'out'
) => {
	const clip = timelineState.selectedClip;
	const track = clip?.keyframeTracks.get(appState.selectedKeyframeParam);
	if (!clip || !track) return;

	if (inOrOut === 'in') {
		track.easeIn[keyframeIndex] = easing;
	} else {
		track.easeOut[keyframeIndex] = easing;
	}
	console.log(track);
	timelineState.invalidate = true;
};

export const deleteKeyframe = (index: number) => {
	const clip = timelineState.selectedClip;
	const track = clip?.keyframeTracks.get(appState.selectedKeyframeParam);
	const frame = track?.frames[index];
	if (!clip || !track || typeof frame === 'undefined') return;

	historyManager.newCommand({
		action: 'deleteKeyframe',
		data: {
			clipId: clip.id,
			frame,
			param: appState.selectedKeyframeParam,
			value: clip.params[appState.selectedKeyframeParam],
			easeIn: track.easeIn[index],
			easeOut: track.easeOut[index]
		}
	});

	removeKeyframe(clip, frame, appState.selectedKeyframeParam);

	setParamsFromKeyframes(timelineState.currentFrame);
	workerManager.sendClip(clip);
};

export const removeKeyframe = (clip: Clip, frame: number, param: number) => {
	const track = clip?.keyframeTracks.get(param);
	const index = track?.frames.findIndex((f) => f === frame);
	if (!clip || !track || typeof index === 'undefined' || index < 0) {
		throw new Error('keyframe does not exist');
	}
	/* 	const tracksToRemove = [];
	if (keyframeIndex === 0 || keyframeIndex === 1) {
		indexToRemove.push(0);
		indexToRemove.push(1);
	} else {
		indexToRemove.push(keyframeIndex);
	} */

	/* 	for (const i of indexToRemove) { */
	track.frames.splice(index, 1);
	track.values.splice(index, 1);
	track.savedFrames.splice(index, 1);
	track.easeIn.splice(index, 1);
	track.easeOut.splice(index, 1);
	/* } */

	if (track.frames.length < 1) {
		clip.keyframeTracks.delete(appState.selectedKeyframeParam);
		/* for (const i of indexToRemove) { */
		const activeIndex = clip.keyframeTracksActive.indexOf(index);
		clip.keyframeTracksActive.splice(activeIndex, 1);
		/* } */
	}
};

export const finaliseKeyframe = (clip: Clip, param: number, frame: number) => {
	const track = clip.keyframeTracks.get(param);
	const index = track?.frames.findIndex((f) => f === frame);
	if (!clip || !track || typeof index === 'undefined' || index < 0) {
		throw new Error('keyframe does not exist');
	}

	historyManager.newCommand({
		action: 'updateKeyframe',
		data: {
			clipId: clip.id,
			param,
			frame,
			oldEaseIn: track.easeIn[index],
			newEaseIn: track.easeIn[index],
			oldEaseOut: track.easeOut[index],
			newEaseOut: track.easeOut[index],
			newValue: track.values[index],
			oldValue: track.values[index]
		}
	});
};

export const getKeyframeAtMousePosition = (mouseX: number, mouseY: number, clip: Clip) => {
	const keyframeTrack = clip.keyframeTracks.get(appState.selectedKeyframeParam);
	if (!keyframeTrack) throw new Error('No keyframe track');
	const { getFrameX, getValY } = getKeyframePositionHelpers(clip, keyframeTrack);
	const padding = 8;

	for (let i = 0; i < keyframeTrack.frames.length; i++) {
		const kfX = getFrameX(keyframeTrack.frames[i]);
		const kfY = getValY(keyframeTrack.values[i]);

		if (
			mouseX >= kfX - padding &&
			mouseX <= kfX + padding &&
			mouseY >= kfY - padding &&
			mouseY <= kfY + padding
		) {
			return i;
		}
	}
	return -1;
};

export const setParamsFromKeyframes = (frameNumber: number) => {
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			if (clip.keyframeTracksActive.length < 1) continue;

			const clipFrame = frameNumber - clip.start;
			const keyframesThisFrame: number[] = [];
			for (const param of clip.keyframeTracksActive) {
				const track = clip.keyframeTracks.get(param);
				if (!track) continue;
				const count = track.values.length;
				for (let i = 0; i < count; i++) {
					if (track.frames[i] === clipFrame) {
						keyframesThisFrame.push(param);
					}
				}

				if (clipFrame <= track.frames[0]) {
					clip.params[param] = track.values[0];
					continue;
				}
				if (clipFrame >= track.frames[count - 1]) {
					clip.params[param] = track.values[count - 1];
					continue;
				}

				// Find the first keyframe that is AFTER our current time
				let i = 1;
				for (; i < count; i++) {
					if (track.frames[i] > clipFrame) break;
				}

				const t0 = track.frames[i - 1];
				const t1 = track.frames[i];
				const v0 = track.values[i - 1];
				const v1 = track.values[i];

				if (track.easeOut[i - 1] === 0) {
					clip.params[param] = v0;
					continue;
				}

				const t = (clipFrame - t0) / (t1 - t0);
				let alpha;
				const intensity = 0.8;
				const outEase = track.easeOut[i - 1] === 2;
				const inEase = track.easeIn[i] === 2;

				if (!outEase && !inEase) {
					// Linear
					alpha = t;
				} else {
					// Cubic Bezier interpolation
					// If Ease is false, we set the handle to 0 (start) or 1 (end) for Linear.
					const cp1 = outEase ? intensity : 0;
					const cp2 = inEase ? 1 - intensity : 1;
					alpha =
						3 * Math.pow(1 - t, 2) * t * cp1 + 3 * (1 - t) * Math.pow(t, 2) * cp2 + Math.pow(t, 3);
				}

				const value = v0 + (v1 - v0) * alpha;
				clip.params[param] = Math.round(value * 1000) / 1000;
			}
			clip.keyframesOnThisFrame = keyframesThisFrame;
		}
	}
};
