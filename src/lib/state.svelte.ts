import type { Source } from './source/source.svelte';
import type { Clip } from './clip/clip.svelte';
import { HistoryManager } from './history/history';
import { AudioState } from './audio/audio.svelte';
import type { Font, Track } from './types';

type DragAndDropState = {
	active: boolean;
	x: number;
	y: number;
	showIcon: boolean;
	source: Source | null;
};

class AppState {
	mediaWorker?: Worker;
	waveformCanvas?: HTMLCanvasElement;
	sources = $state<Source[]>([]);
	showPalette = $state(false);
	palettePage = $state<'search' | 'export' | 'import' | 'about'>('search');
	audioLevel = $state([0, 0]);
	encoderProgress = $state({ message: 'starting', percentage: 0, fail: false });
	mouseIsDown = $state(false);
	dragAndDrop = $state<DragAndDropState>({
		active: false,
		x: 0,
		y: 0,
		showIcon: true,
		source: null
	});

	fonts: Font[] = [];
	disableKeyboardShortcuts = false;
	lockPalette = false;
	importSuccessCallback: (source: Source, gap: number) => void = () => {};
	fileToImport: File | null = null;
	mouseMoveOwner: 'timeline' | 'program' = 'timeline';
}

export const appState = new AppState();

class TimelineState {
	clips: Clip[] = [];
	tracks: Track[] = [];
	duration = $state(1800); // frames
	currentFrame = $state(0);
	playing = $state(false);
	width = $state(0); // pixels
	height = 0; // pixels
	selectedClip = $state<Clip | null>(null);
	selectedClips = new Set<Clip>();

	action: 'none' | 'selecting' = 'none';
	zoom = 0.9;
	offset = -0.055; // percentage, 0...1
	offsetStart = 0; // percentage, 0...1
	dragOffset = { x: 0, y: 0 }; // pixels
	dragStart = { x: 0, y: 0 }; // pixels
	hoverClipId = '';
	focusedTrack = 0;
	padding = 100;
	//trackTops = [0, 50, 100, 150];
	//trackHeights = [35, 35];
	trackDropZone = -1;
	invalidate = false;
	invalidateWaveform = false;
}

export const timelineState = new TimelineState();
export const audioState = new AudioState();
export const historyManager = new HistoryManager();
