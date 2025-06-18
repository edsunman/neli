import type { Source } from './source/source';
import type { Clip } from './clip/clip';
import { HistoryCommands } from './history/history';
import type { WebGPURenderer } from './renderer/renderer';

class AppState {
	renderer: WebGPURenderer | null = null;
	mediaWorker: Worker | null = null;
	sources = $state<Source[]>([]);
	showPalette = $state(false);
}

export const appState = new AppState();

class TimelineState {
	clips = $state<Clip[]>([]);
	duration = $state(9000); // frames
	currentFrame = $state(0);
	playing = $state(false);
	width = $state(0); // pixels
	selectedClip = $state.raw<Clip | null>(null);

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

export const appHistory = new HistoryCommands();
