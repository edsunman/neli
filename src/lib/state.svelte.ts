import { Source } from './source/source.svelte';
import type { Clip } from './clip/clip.svelte';
import { HistoryManager } from './history/history';
import { AudioState } from './audio/audio.svelte';
import type { DragAndDropState, FolderGroup, Font, Track } from './types';

class AppState {
	mediaWorker?: Worker;
	waveformCanvas?: HTMLCanvasElement;
	sources = $state<Source[]>([]);
	selectedSource = $state<Source | null>();
	showPalette = $state(false);
	palettePage = $state<'search' | 'export' | 'import' | 'about'>('search');
	audioLevel = $state([0, 0]);
	encoderProgress = $state({ message: 'starting', percentage: 0, fail: false });
	mouseIsDown = $state(false);
	dragAndDrop = $state<DragAndDropState>({
		clicked: false,
		active: false,
		x: 0,
		y: 0,
		showIcon: false,
		source: null
	});
	folderGroups: FolderGroup[] = $state([]);

	fonts: Font[] = [];
	disableKeyboardShortcuts = false;
	lockPalette = false;
	importSuccessCallback: (source: Source, gap: number) => void = () => {};
	exportSuccessCallback: () => void = () => {};
	fileToImport: File | null = null;
	mouseMoveOwner: 'timeline' | 'program' = 'timeline';
}

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
	offset = -1 / 18; // (-0.055) percentage, 0...1
	offsetStart = 0; // percentage, 0...1
	dragOffset = { x: 0, y: 0 }; // pixels
	dragStart = { x: 0, y: 0 }; // pixels
	hoverClipId = '';
	focusedTrack = 0;
	padding = 100;
	trackDropZone = -1;
	showPlayhead = true;
	invalidate = false;
	invalidateWaveform = false;
}

class ProgramState {
	timelineWidth = $state(0); // pixels
	duration = $state(1000); // frames
	currentFrame = $state(0);
	invalidateTimeline = false;
}

export const appState = new AppState();
export const timelineState = new TimelineState();
export const programState = new ProgramState();
export const audioState = new AudioState();
export const historyManager = new HistoryManager();
