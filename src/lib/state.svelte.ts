import type { Source } from './source/source';
import type { Clip } from './clip/clip.svelte';
import { HistoryManager } from './history/history';
import { AudioState } from './audio/audio';

class AppState {
	mediaWorker: Worker | null = null;
	sources = $state<Source[]>([]);
	showPalette = $state(false);
	audioLevel = $state([0, 0]);
	encoderProgress = $state({ message: 'starting', percentage: 0 });
	disableHoverStates = $state(false);

	disableKeyboardShortcuts = false;
	lockPalette = false;
	mouseMoveOwner: 'timeline' | 'program' = 'timeline';
}

export const appState = new AppState();

class TimelineState {
	clips: Clip[] = [];
	duration = $state(9000); // frames
	currentFrame = $state(0);
	playing = $state(false);
	width = $state(0); // pixels
	selectedClip = $state<Clip | null>(null);

	zoom = 0.9;
	offset = -0.055; // percentage, 0...1
	offsetStart = 0; // percentage, 0...1
	dragOffset = 0; // pixels
	dragStart = 0; // pixels
	hoverClipId = '';
	highlightTrack = 0;
	invalidate = false;
}

export const timelineState = new TimelineState();
export const audioState = new AudioState();
export const historyManager = new HistoryManager();
