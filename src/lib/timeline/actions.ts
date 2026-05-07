import {
	appState,
	historyManager,
	programState,
	projectManager,
	timelineState,
	workerManager
} from '$lib/state.svelte';
import { calculateMaxZoomLevel, canvasPixelToFrame } from './utils';
import { pauseAudio, runAudio } from '$lib/audio/actions';
import type { SourceType, TrackType } from '$lib/types';
import { removeHoverAllClips } from '$lib/clip/actions.svelte';
import type { Clip } from '$lib/clip/clip.svelte';
import { startProgramPlayLoop } from '$lib/program/actions';
import { setParamsFromKeyframes } from '$lib/clip/keyframes';

export const setCurrentFrame = (frame: number, updateWorker = true) => {
	// TODO: debounce this - if same frame is called twice return early
	if (frame < 0) frame = 0;
	if (frame > timelineState.duration - 1) frame = timelineState.duration - 1;
	if (updateWorker) workerManager.seek(frame);
	timelineState.currentFrame = frame;
	setParamsFromKeyframes();
	timelineState.invalidate = true;
};

export const setCurrentFrameFromOffset = (canvasOffset: number, updateWorker = true) => {
	if (timelineState.playing) pause();
	const frame = canvasPixelToFrame(canvasOffset);
	setCurrentFrame(frame, updateWorker);
};

export const play = async () => {
	const data = await workerManager.play(timelineState.currentFrame);
	if (data.workerStarted) {
		if (appState.selectedSource) {
			startProgramPlayLoop();
		} else {
			startPlayLoop();
		}
	}
};

export const startPlayLoop = () => {
	timelineState.playing = true;
	//deselectAllClips();
	programState.selectedClip = null;

	const msPerFrame = 1000 / 30;
	const epsilon = 1; // Tolerance for smoother playback
	let accumulator = 0;
	let lastTime = 0;
	let firstTimestamp = 0;

	const loop = (timestamp: number) => {
		if (!timelineState.playing) return;

		if (lastTime === 0) lastTime = timestamp;
		if (firstTimestamp === 0) firstTimestamp = timestamp;
		if (timelineState.currentFrame >= timelineState.duration - 1) {
			timelineState.currentFrame = timelineState.duration - 1;
			pause();
		}

		const deltaTime = timestamp - lastTime;
		lastTime = timestamp;
		accumulator += deltaTime;

		while (accumulator >= msPerFrame - epsilon) {
			timelineState.currentFrame++;
			accumulator -= msPerFrame;
			timelineState.invalidate = true;
			setParamsFromKeyframes();
		}

		const elapsedTimeMs = timestamp - firstTimestamp;
		runAudio(timelineState.currentFrame, elapsedTimeMs);
		// TODO: I think we only need to update selected clip here

		if (timelineState.playing) requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
};

export const pause = () => {
	if (!timelineState.playing) return;
	timelineState.playing = false;
	workerManager.pause(timelineState.currentFrame);
	pauseAudio();
};

export const centerViewOnPlayhead = () => {
	const playheadPercent = timelineState.currentFrame / timelineState.duration;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	timelineState.offset = playheadPercent - percentOfTimelineVisible / 2;
	checkViewBounds();
};

export const checkViewBounds = () => {
	const padding = 0.05 / timelineState.zoom;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	const maxPercentAllowed = 1 - percentOfTimelineVisible;

	if (timelineState.offset < 0 - padding) {
		timelineState.offset = 0 - padding;
	}
	if (timelineState.offset > maxPercentAllowed + padding)
		timelineState.offset = maxPercentAllowed + padding;
};

export const zoomIn = () => {
	timelineState.zoom = timelineState.zoom * 2;

	const maxZoom = calculateMaxZoomLevel();
	if (timelineState.zoom > maxZoom) timelineState.zoom = maxZoom;

	centerViewOnPlayhead();
	checkViewBounds();
	timelineState.invalidate = true;
	timelineState.invalidateWaveform = true;
};

export const zoomOut = () => {
	const center = timelineState.offset + 0.5 / timelineState.zoom;
	timelineState.zoom = timelineState.zoom / 2;
	timelineState.offset = center - 0.5 / timelineState.zoom;
	if (timelineState.zoom < 0.9) timelineState.zoom = 0.9;
	checkViewBounds();
	timelineState.invalidate = true;
	timelineState.invalidateWaveform = true;
};

export const setZoom = (zoomAmount: number) => {
	timelineState.zoom = zoomAmount;
	centerViewOnPlayhead();
	checkViewBounds();
	timelineState.invalidate = true;
	timelineState.invalidateWaveform = true;
};

export const zoomToFit = () => {
	let lastFrame = 0;
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (clip.start + clip.duration > lastFrame) lastFrame = clip.start + clip.duration;
	}

	if (lastFrame < 1) {
		setZoom(0.9);
		return;
	}

	const percentOfTimeline = lastFrame / timelineState.duration;
	timelineState.zoom = 0.95 / percentOfTimeline;

	const middleFrame = lastFrame / 2;
	const middleFramePercent = middleFrame / timelineState.duration;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	timelineState.offset = middleFramePercent - percentOfTimelineVisible / 2;
	timelineState.invalidateWaveform = true;
};

export const updateGrabbedPosition = () => {
	const dragOffsetX = timelineState.mousePosition.x - timelineState.mouseDownPosition.x;
	const offsetPercent = dragOffsetX / timelineState.width;
	timelineState.offset = timelineState.offsetStart - offsetPercent / timelineState.zoom;

	const padding = 0.05 / timelineState.zoom;
	if (timelineState.offset < 0 - padding) timelineState.offset = 0 - padding;
	const barWidth = 1 / timelineState.zoom;
	if (timelineState.offset + barWidth >= 1 + padding) timelineState.offset = 1 - barWidth + padding;
};

export const updateScrollPosition = () => {
	const dragOffsetX = timelineState.mousePosition.x - timelineState.mouseDownPosition.x;
	const offsetPercent = dragOffsetX / timelineState.width;
	timelineState.offset = timelineState.offsetStart + offsetPercent;

	const padding = 0.05 / timelineState.zoom;
	if (timelineState.offset < 0 - padding) timelineState.offset = 0 - padding;
	const barWidth = 1 / timelineState.zoom;
	if (timelineState.offset + barWidth >= 1 + padding) timelineState.offset = 1 - barWidth + padding;
};

export const focusTrack = (trackNumber: number) => {
	timelineState.focusedTrack = trackNumber;

	for (let i = 0; i < timelineState.tracks.length; i++) {
		if (trackNumber === 0) {
			timelineState.tracks[i].height = 35;
		} else if (i === trackNumber - 1) {
			timelineState.tracks[i].height = 125;
		} else {
			timelineState.tracks[i].height = 10;
		}
	}

	if (timelineState.selectedClip && timelineState.selectedClip.keyframeTracksActive.length > 0) {
		const index = timelineState.selectedClip.keyframeTracksActive.findIndex(
			(p) => p === appState.selectedKeyframeParam
		);
		if (index < 0)
			appState.selectedKeyframeParam = timelineState.selectedClip.keyframeTracksActive[0];
	}

	setTrackPositions();
	timelineState.invalidateWaveform = true;
};

/** Call after changing track heights to recalculate and set positions */
export const setTrackPositions = () => {
	const flexHeight = timelineState.height - 30;
	const rulerContainerHeight = flexHeight * 0.2 + 5;
	const trackContainerHeight = flexHeight - rulerContainerHeight;
	let trackPadding = timelineState.focusedTrack === 0 ? 15 : 10;
	if (trackContainerHeight < 220) trackPadding = 5;

	let totalTrackHeight = 0;
	for (let i = 0; i < timelineState.tracks.length; i++) {
		if (
			timelineState.tracks.length > 2 &&
			trackContainerHeight < 190 &&
			timelineState.focusedTrack > 0
		) {
			// very small screen, only show focused track in focus mode
			timelineState.tracks[i].top = i === timelineState.focusedTrack - 1 ? 0 : 1000;
			totalTrackHeight = 110;
		} else {
			timelineState.tracks[i].top = totalTrackHeight;
			totalTrackHeight += timelineState.tracks[i].height;
			if (i < timelineState.tracks.length - 1) {
				totalTrackHeight += trackPadding;
			}
		}
	}

	const topOfAllTracks = (trackContainerHeight - totalTrackHeight) / 2;
	for (let i = 0; i < timelineState.tracks.length; i++) {
		timelineState.tracks[i].top += Math.floor(topOfAllTracks + rulerContainerHeight);
	}
	const trackTypes = timelineState.tracks.map((t) => t.type);
	projectManager.updateProject({ tracks: trackTypes });
};

export const setTrackLocks = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;

	const tracksInUse = new Set<number>();
	const audioTracksInUse = new Set<number>();
	const videoTracksInUse = new Set<number>();
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (timelineState.selectedClip && clip.id === timelineState.selectedClip.id) continue;

		tracksInUse.add(clip.track);
		if (clip.source.type === 'audio') audioTracksInUse.add(clip.track);
		if (clip.source.type === 'video' || clip.source.type === 'test')
			videoTracksInUse.add(clip.track);
	}

	const trackType = getTrackTypeFromSourceType(clip.source.type);

	// Lock all tracks
	for (const track of timelineState.tracks) {
		track.lock = true;
		track.lockTop = true;
		track.lockBottom = true;
	}

	// Unlock tracks of clip type
	for (let i = 0; i < timelineState.tracks.length; i++) {
		if (timelineState.tracks[i].type === trackType || timelineState.tracks[i].type === 'none')
			timelineState.tracks[i].lock = false;
	}

	// If track limits met return early
	if (
		trackType === 'video' &&
		(videoTracksInUse.size >= 2 || audioTracksInUse.size + videoTracksInUse.size >= 3)
	)
		return;
	if (trackType === 'audio' && audioTracksInUse.size + videoTracksInUse.size >= 3) return;

	// If there are 4 tracks return early
	if (tracksInUse.size >= 4) return;

	// If track is the top track unlock the top (unless empty)
	// unlock the bottom if each track and the one below has something on it
	for (let i = 0; i < timelineState.tracks.length; i++) {
		if (i === 0) {
			if (tracksInUse.has(i + 1)) timelineState.tracks[i].lockTop = false;
		}
		if (i === timelineState.tracks.length - 1) {
			if (tracksInUse.has(i + 1)) timelineState.tracks[i].lockBottom = false;
		}
		if (i < timelineState.tracks.length - 1) {
			if (tracksInUse.has(i + 1) && tracksInUse.has(i + 2))
				timelineState.tracks[i].lockBottom = false;
		}
	}
};

export const addTrack = (trackNumber: number) => {
	timelineState.tracks.push({
		height: 35,
		top: 0,
		lockBottom: true,
		lockTop: true,
		lock: false,
		type: 'none'
	});
	historyManager.pushAction({ action: 'addTrack', data: { number: trackNumber, type: 'none' } });
	const movedClips: Clip[] = [];
	for (const clip of timelineState.clips) {
		if (clip.track > trackNumber) {
			clip.track++;
			movedClips.push(clip);
			historyManager.pushAction({
				action: 'moveClip',
				data: {
					clipId: clip.id,
					newStart: clip.start,
					oldStart: clip.start,
					newTrack: clip.track,
					oldTrack: clip.track - 1
				}
			});
		}
	}
	workerManager.sendClip(movedClips);
	projectManager.updateClip(movedClips);

	setTrackPositions();
};

export const removeTrack = (trackNumber: number) => {
	const trackType = timelineState.tracks.splice(trackNumber - 1, 1)[0].type;
	historyManager.pushAction({
		action: 'removeTrack',
		data: { number: trackNumber, type: trackType }
	});
	const modifiedClips: Clip[] = [];
	for (const clip of timelineState.clips) {
		if (clip.track > trackNumber) {
			clip.track--;
			modifiedClips.push(clip);
			historyManager.pushAction({
				action: 'moveClip',
				data: {
					clipId: clip.id,
					newStart: clip.start,
					oldStart: clip.start,
					newTrack: clip.track,
					oldTrack: clip.track + 1
				}
			});
		}
		workerManager.sendClip(modifiedClips);
		projectManager.updateClip(modifiedClips);
	}

	setTrackPositions();
};

/** Calculate and set all track types and remove empty tracks */
export const setAllTrackTypes = () => {
	const usedTracks = new Map<number, TrackType>();
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		const trackType = getTrackTypeFromSourceType(clip.source.type);
		usedTracks.set(clip.track, trackType);
	}

	// set correct track type
	for (let i = 0; i < timelineState.tracks.length; i++) {
		const trackType = usedTracks.get(i + 1);
		if (trackType) {
			timelineState.tracks[i].type = trackType;
		} else {
			timelineState.tracks[i].type = 'none';
			if (timelineState.focusedTrack === i + 1) {
				focusTrack(0);
			}
		}
	}

	// loop backwards and remove unused tracks
	for (let i = timelineState.tracks.length - 1; i >= 0; i--) {
		if (timelineState.tracks.length > 2) {
			if (!usedTracks.has(i + 1)) {
				removeTrack(i + 1);
			}
		} else {
			break;
		}
	}

	setTrackPositions();
};

export const getTopTrackOfType = (type: TrackType) => {
	let trackNumber = 0;
	for (let i = 0; i < timelineState.tracks.length; i++) {
		if (timelineState.tracks[i].type === type || timelineState.tracks[i].type === 'none') {
			trackNumber = i + 1;
			break;
		}
	}
	return trackNumber;
};

export const getTrackTypeFromSourceType = (sourceType: SourceType): TrackType => {
	if (sourceType === 'test' || sourceType === 'video') return 'video';
	if (sourceType === 'audio') return 'audio';
	return 'graphics';
};

export const focusClip = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;

	const clipPercentOfTimeline = clip.duration / timelineState.duration;
	timelineState.zoom = 0.95 / clipPercentOfTimeline;

	const middleFrame = clip.start + clip.duration / 2;
	const middleFramePercent = middleFrame / timelineState.duration;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	timelineState.offset = middleFramePercent - percentOfTimelineVisible / 2;

	focusTrack(clip.track);
};

export const extendTimeline = (endPointFrames: number) => {
	const oldTimlineDuration = timelineState.duration;

	const framesPerMinute = 30 * 60;
	const roundedMinutes = Math.ceil(endPointFrames / framesPerMinute);
	let roundedFrameNumber = roundedMinutes * framesPerMinute;
	if (roundedFrameNumber > 9000) roundedFrameNumber = 9000;

	if (roundedFrameNumber <= timelineState.duration) return;

	timelineState.duration = roundedFrameNumber;
	projectManager.updateProject({ duration: roundedFrameNumber });

	const ratio = timelineState.duration / oldTimlineDuration;
	timelineState.zoom = timelineState.zoom * ratio;
	timelineState.offset = timelineState.offset / ratio;
};

export const getUsedTimelineDuration = () => {
	let lastFrame = 0;
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		const lastClipFrame = clip.start + clip.duration;
		if (lastClipFrame > lastFrame) lastFrame = lastClipFrame;
	}
	return lastFrame;
};

export const setTimelineTool = (tool: typeof timelineState.selectedTool) => {
	if (appState.selectedSource) return;
	if (timelineState.action === 'selecting') return;
	removeHoverAllClips();
	timelineState.invalidate = true;
	timelineState.selectedTool = tool;
};

export const goToNextKeyframe = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const track = clip.keyframeTracks.get(appState.selectedKeyframeParam);
	if (!track || timelineState.focusedTrack < 1) {
		setCurrentFrame(clip.start + clip.duration - 1);
		return;
	}
	let nextKeyframe;
	for (const keyframe of track.keyframes) {
		if (keyframe.frame + clip.start > timelineState.currentFrame) {
			nextKeyframe = keyframe;
			break;
		}
	}
	if (nextKeyframe) {
		setCurrentFrame(clip.start + nextKeyframe.frame);
		return;
	}
	setCurrentFrame(clip.start + clip.duration - 1);
};

export const goToPreviousKeyframe = () => {
	const clip = timelineState.selectedClip;
	if (!clip) return;
	const track = clip.keyframeTracks.get(appState.selectedKeyframeParam);
	if (!track || timelineState.focusedTrack < 1) {
		setCurrentFrame(clip.start);
		return;
	}
	let prevKeyframe;
	for (const keyframe of track.keyframes) {
		if (keyframe.frame + clip.start >= timelineState.currentFrame) {
			break;
		}
		prevKeyframe = keyframe;
	}
	if (prevKeyframe) {
		setCurrentFrame(clip.start + prevKeyframe.frame);
		return;
	}
	setCurrentFrame(clip.start);
};
