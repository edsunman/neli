import { pauseWorker, playWorker, seekWorker } from '$lib/worker/actions.svelte';
import { historyManager, timelineState } from '$lib/state.svelte';
import { calculateMaxZoomLevel, canvasPixelToFrame } from './utils';
import { pauseAudio, runAudio } from '$lib/audio/actions';

export const setCurrentFrame = (frame: number) => {
	if (frame < 0) frame = 0;
	if (frame > timelineState.duration - 1) frame = timelineState.duration - 1;
	seekWorker(frame);
	timelineState.currentFrame = frame;
	timelineState.invalidate = true;
};

export const setCurrentFrameFromOffset = (canvasOffset: number) => {
	if (timelineState.playing) pause();
	const frame = canvasPixelToFrame(canvasOffset);
	setCurrentFrame(frame);
};

export const play = () => {
	playWorker(timelineState.currentFrame);
};

export const startPlayLoop = () => {
	timelineState.playing = true;
	timelineState.selectedClip = null;
	//playWorker(timelineState.currentFrame);

	const MS_PER_FRAME = 1000 / 30; // For 30 FPS
	let accumulator = 0;
	let lastTime = 0;
	let firstTimestamp = 0;

	const loop = (timestamp: number) => {
		if (!timelineState.playing) return;

		if (lastTime === 0) {
			lastTime = timestamp;
		}

		if (firstTimestamp === 0) {
			firstTimestamp = timestamp;
		}

		const deltaTime = timestamp - lastTime;
		lastTime = timestamp;

		accumulator += deltaTime;

		const oldFrame = timelineState.currentFrame;

		if (oldFrame >= timelineState.duration - 1) {
			// dont play past timeine end
			pause();
		}

		// the - 1 here is an 'epsilon' to make playback smoother
		while (accumulator >= MS_PER_FRAME - 1) {
			timelineState.currentFrame++;
			accumulator -= MS_PER_FRAME;
		}

		const elapsedTimeMs = timestamp - firstTimestamp;
		runAudio(timelineState.currentFrame, elapsedTimeMs);

		if (timelineState.currentFrame !== oldFrame) {
			timelineState.invalidate = true;
		}

		if (timelineState.playing) requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
};

export const pause = () => {
	timelineState.playing = false;
	pauseWorker(timelineState.currentFrame);
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
	if (timelineState.offset < 0) {
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
	//deselectClipIfTooSmall();
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
	if (timelineState.clips.length < 1) {
		setZoom(0.9);
		return;
	}
	let lastFrame = 0;
	for (const clip of timelineState.clips) {
		if (clip.start + clip.duration > lastFrame) lastFrame = clip.start + clip.duration;
	}
	//lastFrame += 100;
	const percentOfTimeline = lastFrame / timelineState.duration;
	timelineState.zoom = 0.95 / percentOfTimeline;

	const middleFrame = lastFrame / 2;
	const middleFramePercent = middleFrame / timelineState.duration;
	const percentOfTimelineVisible = 1 / timelineState.zoom;
	timelineState.offset = middleFramePercent - percentOfTimelineVisible / 2;
	timelineState.invalidate = true;
};

export const updateScrollPosition = () => {
	const padding = 0.05 / timelineState.zoom;
	const offsetPercent = timelineState.dragOffset.x / timelineState.width;
	timelineState.offset = timelineState.offsetStart + offsetPercent;
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
			timelineState.tracks[i].height = 110;
		} else {
			timelineState.tracks[i].height = 20;
		}
	}

	setTrackPositions();
	timelineState.invalidateWaveform = true;
};

/** Call after changing track heights to recalculate and set positions */
export const setTrackPositions = () => {
	//timelineState.trackTops.length = 0;

	const flexHeight = timelineState.height - 35;
	const trackContainerHeight = flexHeight * 0.8;
	const rulerContainerHeight = flexHeight * 0.2;
	let trackPadding = timelineState.focusedTrack === 0 ? 15 : 5;
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
};

export const setTrackLocks = () => {
	// count clips on each track
	const tracksInUse = new Set<number>();
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (timelineState.selectedClip && clip.id === timelineState.selectedClip.id) continue;
		tracksInUse.add(clip.track);
	}

	// lock all tracks
	for (const track of timelineState.tracks) {
		track.lockTop = true;
		track.lockBottom = true;
	}

	// if clip is audio and there are already 3 audio or video tracks then lock the others

	// if clip is video and there are already 2 video tracks lock the others

	// lock tops and bottoms

	// if there are 4 tracks return early
	if (timelineState.tracks.length >= 4) return;

	// if track is top track unlock the top (unless empty)
	// for all track not the bottom, unlock the bottom if that track and the one below has someing on it
	for (let i = 0; i < timelineState.tracks.length; i++) {
		if (i === 0) {
			//const clipCount = countClipsOnTrack(i + 1, false);
			if (tracksInUse.has(i + 1)) timelineState.tracks[i].lockTop = false;
		}
		if (i === timelineState.tracks.length - 1) {
			//const clipCount = countClipsOnTrack(i + 1, false);
			if (tracksInUse.has(i + 1)) timelineState.tracks[i].lockBottom = false;
		}
		if (i < timelineState.tracks.length - 1) {
			//const clipCount = countClipsOnTrack(i + 1, false);
			//const clipCountBelow = countClipsOnTrack(i + 2, false);
			if (tracksInUse.has(i + 1) && tracksInUse.has(i + 2))
				timelineState.tracks[i].lockBottom = false;
		}
	}
};

export const addTrack = (trackNumber: number) => {
	timelineState.tracks.push({ height: 35, top: 0, lockBottom: true, lockTop: true });
	historyManager.pushAction({ action: 'addTrack', data: { trackNumber } });
	for (const clip of timelineState.clips) {
		if (clip.track > trackNumber) {
			//clip.savedTrack = clip.track;
			clip.track++;
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

	setTrackPositions();
};

export const removeTrack = (trackNumber: number) => {
	timelineState.tracks.splice(trackNumber - 1, 1);
	historyManager.pushAction({ action: 'removeTrack', data: { trackNumber } });
	for (const clip of timelineState.clips) {
		if (clip.track > trackNumber) {
			//clip.savedTrack = clip.track;
			clip.track--;
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
	}

	setTrackPositions();
};

export const removeEmptyTracks = () => {
	//return;
	if (timelineState.tracks.length <= 2) return;
	const usedTracks = new Set<number>();
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		usedTracks.add(clip.track);
	}
	for (let i = timelineState.tracks.length - 1; i >= 0; i--) {
		if (!usedTracks.has(i + 1)) {
			removeTrack(i + 1);
		}
	}

	setTrackPositions();
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
	//checkViewBounds();

	focusTrack(clip.track);
};

export const extendTimeline = (endPoint: number) => {
	const oldTimlineDuration = timelineState.duration;

	const framesPerMinute = 30 * 60;
	const roundedMinutes = Math.ceil(endPoint / framesPerMinute);
	let roundedFrameNumber = roundedMinutes * framesPerMinute;
	if (roundedFrameNumber > 9000) roundedFrameNumber = 9000;

	if (roundedFrameNumber <= timelineState.duration) return;

	timelineState.duration = roundedFrameNumber;

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
