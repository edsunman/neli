import {
	appState,
	audioState,
	historyManager,
	projectManager,
	timelineState,
	workerManager
} from '$lib/state.svelte';
import type { Keyframe } from '$lib/types';
import type { Clip } from './clip.svelte';
import { getKeyframePositionHelpers, roundTo } from './utils';

export const addKeyframe = (
	clip: Clip,
	frame: number,
	param: number,
	value: number,
	easeIn = 1,
	easeOut = 1
) => {
	if (frame < 0 || frame > clip.duration) return false;

	const newKeyframe = {
		frame,
		savedFrame: frame,
		value,
		savedValue: value,
		easeIn,
		savedEaseIn: easeIn,
		easeOut,
		savedEaseOut: easeOut
	};

	let track = clip.keyframeTracks.get(param);
	if (!track) {
		track = { keyframes: [newKeyframe] };
		clip.keyframeTracks.set(param, track);
		timelineState.keyframeTracksActive.push(param);
		return;
	}

	const keyframes = track.keyframes;
	let insertIndex = 0;
	while (insertIndex < keyframes.length && keyframes[insertIndex].frame < frame) {
		insertIndex++;
	}

	if (insertIndex < keyframes.length && keyframes[insertIndex].frame === frame) {
		throw new Error('Keyframe already exists for this frame');
	}

	keyframes.splice(insertIndex, 0, newKeyframe);

	return true;
};

export const updateKeyframeEasing = (
	keyframeIndex: number,
	easing: number,
	inOrOut: 'in' | 'out'
) => {
	const clip = timelineState.selectedClip;
	const keyframe = getKeyframeByIndex(clip, appState.selectedKeyframeParam, keyframeIndex);
	if (!clip || !keyframe) return;
	if (inOrOut === 'in') {
		keyframe.easeIn = easing;
	} else {
		keyframe.easeOut = easing;
	}

	finaliseKeyframe(appState.selectedKeyframeParam, keyframe);
	historyManager.finishCommand();
	workerManager.sendClip(clip);
	projectManager.updateClip(clip);
	timelineState.invalidate = true;
};

export const deleteKeyframe = (keyframeIndex: number) => {
	const clip = timelineState.selectedClip;
	const keyframeParam = appState.selectedKeyframeParam;
	const keyframe = getKeyframeByIndex(clip, keyframeParam, keyframeIndex);
	if (!clip || !keyframe) return;

	const paramsToRemove = getLinkedParams(keyframeParam);
	for (const param of paramsToRemove) {
		historyManager.pushAction({
			action: 'deleteKeyframe',
			data: {
				clipId: clip.id,
				frame: keyframe.frame,
				param: param,
				value: clip.params[param],
				easeIn: keyframe.easeIn,
				easeOut: keyframe.easeOut
			}
		});

		removeKeyframe(clip, keyframe.frame, param);
	}

	setParamsFromKeyframes();
	workerManager.sendClip(clip);
	projectManager.updateClip(clip);
};

export const removeKeyframe = (clip: Clip, frame: number, param: number) => {
	const track = clip?.keyframeTracks.get(param);
	const index = track?.keyframes.findIndex((k) => k.frame === frame);
	if (!clip || !track || typeof index === 'undefined' || index < 0) {
		throw new Error('keyframe does not exist');
	}

	const [removedKeyframe] = track.keyframes.splice(index, 1);
	if (track.keyframes.length < 1) {
		clip.keyframeTracks.delete(param);
		const activeIndex = timelineState.keyframeTracksActive.indexOf(param);
		timelineState.keyframeTracksActive.splice(activeIndex, 1);
	}
	return removedKeyframe;
};

/** Finalise provided keyframe or keyframe at current frame */
export const finaliseKeyframe = (param = appState.selectedKeyframeParam, keyframe?: Keyframe) => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const keyframesToUpdate = new Map<number, Keyframe>();

	let clipFrame: number;
	if (keyframe) {
		clipFrame = keyframe.frame;
		keyframesToUpdate.set(appState.selectedKeyframeParam, keyframe);
	} else {
		clipFrame = timelineState.currentFrame - clip.start;
		const params = getLinkedParams(param);
		for (const param of params) {
			const track = clip.keyframeTracks.get(param);
			if (!track) continue;
			const foundKeyframe = track.keyframes.find((k) => k.frame === clipFrame);
			if (foundKeyframe) keyframesToUpdate.set(param, foundKeyframe);
		}
	}

	for (const [param, keyframe] of keyframesToUpdate) {
		historyManager.pushAction({
			action: 'updateKeyframe',
			data: {
				clipId: clip.id,
				param,
				frame: clipFrame,
				oldEaseIn: keyframe.savedEaseIn,
				newEaseIn: keyframe.easeIn,
				oldEaseOut: keyframe.savedEaseOut,
				newEaseOut: keyframe.easeOut,
				newValue: keyframe.value,
				oldValue: keyframe.savedValue
			}
		});
		keyframe.savedValue = keyframe.value;
		keyframe.savedEaseIn = keyframe.easeIn;
		keyframe.savedEaseOut = keyframe.easeOut;
	}
	projectManager.updateClip(clip);
};

export const createOrUpdateKeyframe = (paramIndices: number[]) => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const clipFrame = timelineState.currentFrame - clip.start;
	appState.selectedKeyframeParam = paramIndices[0];

	for (const paramIndex of paramIndices) {
		const track = clip.keyframeTracks.get(paramIndex);
		const keyframe = track?.keyframes.find((k) => k.frame === clipFrame);
		if (!track || !keyframe) {
			const success = addKeyframe(clip, clipFrame, paramIndex, clip.params[paramIndex]);
			if (!success) continue;
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
			projectManager.updateClip(clip);
			timelineState.keyframesOnThisFrame.push(paramIndex);
			continue;
		} else {
			// need to update
			keyframe.value = clip.params[paramIndex];
		}
	}

	timelineState.invalidate = true;
	workerManager.sendClip(clip);
};

export const createOrDeleteKeyframe = (paramIndices: number[]) => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const clipFrame = timelineState.currentFrame - clip.start;
	appState.selectedKeyframeParam = paramIndices[0];

	for (const paramIndex of paramIndices) {
		const track = clip.keyframeTracks.get(paramIndex);
		const keyframe = track?.keyframes.find((k) => k.frame === clipFrame);
		if (!track || !keyframe) {
			const success = addKeyframe(clip, clipFrame, paramIndex, clip.params[paramIndex]);
			if (!success) continue;
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
			projectManager.updateClip(clip);
			continue;
		} else {
			// need to delete
			removeKeyframe(clip, clipFrame, paramIndex);
			historyManager.pushAction({
				action: 'deleteKeyframe',
				data: {
					clipId: clip.id,
					frame: keyframe.frame,
					param: paramIndex,
					value: keyframe.value,
					easeIn: keyframe.easeIn,
					easeOut: keyframe.easeOut
				}
			});
		}
	}

	workerManager.sendClip(clip);
};

export const getKeyframeAtMousePosition = (mouseX: number, mouseY: number, clip: Clip) => {
	const keyframeTrack = clip.keyframeTracks.get(appState.selectedKeyframeParam);
	if (!keyframeTrack) throw new Error('No keyframe track');
	const { getFrameX, getValY } = getKeyframePositionHelpers(clip, keyframeTrack);
	const padding = 8;

	let foundKeyframe;
	let index = -1;
	for (let i = 0; i < keyframeTrack.keyframes.length; i++) {
		const kfX = getFrameX(keyframeTrack.keyframes[i].frame);
		const kfY = getValY(keyframeTrack.keyframes[i].value);

		if (
			mouseX >= kfX - padding &&
			mouseX <= kfX + padding &&
			mouseY >= kfY - padding &&
			mouseY <= kfY + padding
		) {
			foundKeyframe = keyframeTrack.keyframes[i];
			index = i;
			break;
		}
	}

	return { index, keyframe: foundKeyframe };
};

export const getKeyframeByIndex = (clip: Clip | null, param: number, index: number) => {
	const track = clip?.keyframeTracks.get(param);
	return track?.keyframes[index];
};

export const getKeyframeByFrameNumber = (clip: Clip | null, param: number, frameNumber: number) => {
	const track = clip?.keyframeTracks.get(param);
	return track?.keyframes.find((k) => k.frame === frameNumber);
};

export const setParamsFromKeyframes = () => {
	timelineState.keyframesOnThisFrame.length = 0;

	const frameNumber = timelineState.currentFrame;
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			const clipFrame = frameNumber - clip.start;
			const keyframesThisFrame: number[] = [];
			for (const [param, track] of clip.keyframeTracks) {
				const keyframes = track.keyframes;
				if (!keyframes || keyframes.length === 0) continue;

				const count = keyframes.length;
				for (let i = 0; i < count; i++) {
					if (keyframes[i].frame === clipFrame) {
						keyframesThisFrame.push(param);
						break;
					}
				}

				if (clipFrame <= keyframes[0].frame) {
					clip.params[param] = keyframes[0].value;
					continue;
				}
				if (clipFrame >= keyframes[count - 1].frame) {
					clip.params[param] = keyframes[count - 1].value;
					continue;
				}

				let i = 1;
				for (; i < count; i++) {
					if (keyframes[i].frame > clipFrame) break;
				}

				const k0 = keyframes[i - 1];
				const k1 = keyframes[i];
				if (k0.easeOut === 0) {
					clip.params[param] = k0.value;
					continue;
				}

				const t = (clipFrame - k0.frame) / (k1.frame - k0.frame);
				let alpha;
				const outEase = k0.easeOut === 2;
				const inEase = k1.easeIn === 2;

				if (!outEase && !inEase) {
					alpha = t;
				} else {
					const intensity = 3.5;
					if (outEase && inEase) {
						const tn = Math.pow(t, intensity);
						alpha = tn / (tn + Math.pow(1 - t, intensity));
					} else if (outEase) {
						alpha = Math.pow(t, intensity);
					} else if (inEase) {
						alpha = 1 - Math.pow(1 - t, intensity);
					}
				}

				let value = k0.value + (k1.value - k0.value) * (alpha || 0);
				if (param === 17) {
					value = roundTo(value, 0);
				} else {
					value = roundTo(value, 3);
				}
				clip.params[param] = value;
			}
			if (clip.keyframeTracks.has(4)) {
				const gainNode = audioState.gainNodes.get(clip.id);
				if (gainNode) gainNode.gain.value = clip.params[4];
			}
			if (clip.keyframeTracks.has(5)) {
				const panNode = audioState.panNodes.get(clip.id);
				if (panNode) panNode.pan.value = clip.params[5];
			}

			if (timelineState.selectedClip && timelineState.selectedClip.id === clip.id) {
				timelineState.keyframesOnThisFrame = keyframesThisFrame;
			}
		}
	}
};

export const toggleSelectedParam = () => {
	const params = timelineState.keyframeTracksActive;
	if (!params || params.length < 1) return;
	const currentIndex = params.findIndex((p) => p === appState.selectedKeyframeParam);
	if (currentIndex < 0) {
		appState.selectedKeyframeParam = params[0];
	} else if (currentIndex === params.length - 1) {
		appState.selectedKeyframeParam = params[0];
	} else {
		appState.selectedKeyframeParam = params[currentIndex + 1];
	}
	timelineState.invalidate = true;
};

export const getLinkedParams = (num: number) => {
	const groups = [
		[0, 1],
		[2, 3],
		[12, 13, 14, 15]
	];

	const match = groups.find((group) => group.includes(num));
	return match ?? [num];
};
