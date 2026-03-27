import {
	appState,
	audioState,
	historyManager,
	timelineState,
	workerManager
} from '$lib/state.svelte';
import type { Keyframe } from '$lib/types';
import type { Clip } from './clip.svelte';
import { getKeyframePositionHelpers } from './utils';

export const createOrUpdateKeyframe = (paramIndices: number[]) => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const clipFrame = timelineState.currentFrame - clip.start;
	appState.selectedKeyframeParam = paramIndices[0];

	for (const paramIndex of paramIndices) {
		const track = clip.keyframeTracks.get(paramIndex);
		const keyframe = track?.keyframes.find((k) => k.frame === clipFrame);
		if (!track || !keyframe) {
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
		} else {
			// need to update
			keyframe.value = clip.params[paramIndex];
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
		clip.keyframeTracksActive.push(param);
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

	finaliseKeyframe(keyframe);
	historyManager.finishCommand();
	timelineState.invalidate = true;
};

export const deleteKeyframe = (keyframeIndex: number) => {
	const clip = timelineState.selectedClip;
	const keyframe = getKeyframeByIndex(clip, appState.selectedKeyframeParam, keyframeIndex);
	if (!clip || !keyframe) return;

	historyManager.newCommand({
		action: 'deleteKeyframe',
		data: {
			clipId: clip.id,
			frame: keyframe.frame,
			param: appState.selectedKeyframeParam,
			value: clip.params[appState.selectedKeyframeParam],
			easeIn: keyframe.easeIn,
			easeOut: keyframe.easeOut
		}
	});

	removeKeyframe(clip, keyframe.frame, appState.selectedKeyframeParam);

	setParamsFromKeyframes();
	workerManager.sendClip(clip);
};

export const removeKeyframe = (clip: Clip, frame: number, param: number) => {
	// TODO: handle linked keyframes

	const track = clip?.keyframeTracks.get(param);
	const index = track?.keyframes.findIndex((k) => k.frame === frame);
	if (!clip || !track || typeof index === 'undefined' || index < 0) {
		throw new Error('keyframe does not exist');
	}

	track.keyframes.splice(index, 1);

	if (track.keyframes.length < 1) {
		clip.keyframeTracks.delete(param);
		const activeIndex = clip.keyframeTracksActive.indexOf(index);
		clip.keyframeTracksActive.splice(activeIndex, 1);
	}
};

export const finaliseKeyframe = (keyframe?: Keyframe) => {
	const clip = timelineState.selectedClip;
	let clipFrame;
	if (!keyframe) {
		const clip = timelineState.selectedClip;
		clipFrame = timelineState.currentFrame - (clip?.start || 0);
		keyframe = getKeyframeByFrameNumber(
			timelineState.selectedClip,
			appState.selectedKeyframeParam,
			clipFrame
		);
	} else {
		clipFrame = keyframe.frame;
	}
	if (!clip || !keyframe) {
		throw new Error('keyframe does not exist');
	}

	historyManager.pushAction({
		action: 'updateKeyframe',
		data: {
			clipId: clip.id,
			param: appState.selectedKeyframeParam,
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
	const frameNumber = timelineState.currentFrame;
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (clip.start <= frameNumber && clip.start + clip.duration > frameNumber) {
			if (clip.keyframeTracksActive.length < 1) continue;

			const clipFrame = frameNumber - clip.start;
			const keyframesThisFrame: number[] = [];
			for (const [param, track] of clip.keyframeTracks) {
				const keyframes = track.keyframes;
				if (!keyframes || keyframes.length === 0) continue;

				const count = keyframes.length;

				// Update UI indicator
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
					// Cubic Bezier interpolation
					const intensity = 0.8;
					const cp1 = outEase ? intensity : 0;
					const cp2 = inEase ? 1 - intensity : 1;
					const mt = 1 - t;
					alpha = 3 * (mt * mt) * t * cp1 + 3 * mt * (t * t) * cp2 + t * t * t;
				}

				const value = k0.value + (k1.value - k0.value) * alpha;
				clip.params[param] = Math.round(value * 1000) / 1000;
				/* 				if (param === 4) {
					const gainNode = audioState.gainNodes.get(clip.id);
					if (gainNode) gainNode.gain.value = value;
					
				} */
			}
			if (clip.keyframeTracks.has(4)) {
				const gainNode = audioState.gainNodes.get(clip.id);
				if (gainNode) gainNode.gain.value = clip.params[4];
			}
			if (clip.keyframeTracks.has(5)) {
				const panNode = audioState.panNodes.get(clip.id);
				if (panNode) panNode.pan.value = clip.params[5];
			}

			clip.keyframesOnThisFrame = keyframesThisFrame;
		}
	}
};
