import type { Source } from './source/source';
import type { Clip } from './clip/clip.svelte';
import { HistoryManager } from './history/history';
import { AudioMananger } from './audio/audio';
import type { WebGPURenderer } from './worker/renderer';

class AppState {
	renderer: WebGPURenderer | null = null;
	mediaWorker: Worker | null = null;
	sources = $state<Source[]>([]);
	showPalette = $state(false);
	disableKeyboardShortcuts = false;
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
	//selectedClip: Clip | null = null;

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

export const audioManager = new AudioMananger();
export const historyManager = new HistoryManager();
