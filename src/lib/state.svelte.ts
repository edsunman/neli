import { Source } from './source/source.svelte';
import type { Clip } from './clip/clip.svelte';
import { HistoryManager } from './history/history';
import { AudioState } from './audio/audio.svelte';
import { ProjectManager } from './project/manager.svelte';
import type {
	DragAndDropState,
	Font,
	PropertiesSection,
	ImportState,
	Track,
	PaletteState,
	ClipboardState
} from './types';
import { WorkerManager } from './worker/manager.svelte';

class AppState {
	sources = $state<Source[]>([]);
	selectedSource = $state<Source | null>();
	selectedSourceFolder = $state(0);
	sourceFolders: { id: number }[] = $state([]);
	propertiesSection = $state<PropertiesSection>('project');
	propertiesSavedSection = $state<PropertiesSection>('project');
	progress = $state({ started: false, message: 'starting', percentage: 0, fail: false });
	mouseIsDown = $state(false);

	clipboardState : ClipboardState = {
		clips: []
	}

	palette = $state<PaletteState>({
		open: false,
		page: 'search',
		shrink: '',
		lock: false
	});

	dragAndDrop = $state<DragAndDropState>({
		currentCursor: { x: 0, y: 0 },
		dragFrom: 'sources',
		clicked: false,
		active: false,
		showIcon: false,
		source: null
	});

	import = $state<ImportState>({
		importStarted: false,
		thumbnail: '',
		warningMessage: '',
		fileDetails: null
	});

	project = $state({
		id: '',
		name: '',
		resolution: { height: 1080, width: 1920 },
		aspect: 0
	});

	projectCount = 0;
	fonts: Font[] = [];
	disableKeyboardShortcuts = false;
	exportSuccessCallback: (success: boolean) => void = () => {};
	mouseMoveOwner: 'timeline' | 'program' | 'properties' = 'timeline';
	selectedKeyframeParam = -1;
}

class TimelineState {
	zoom = $state(0.9);
	clips: Clip[] = [];
	tracks: Track[] = [];
	duration = $state(1800); // frames
	currentFrame = $state(0);
	playing = $state(false);
	width = $state(0); // pixels
	height = 0; // pixels
	selectedClip = $state<Clip | null>(null);
	selectedClips = new Set<Clip>();
	selectedTool = $state<'pointer' | 'hand' | 'scissors'>('pointer');

	action: 'none' | 'selecting' = 'none';
	offset = -1 / 18; // (-0.055) percentage, 0...1
	offsetStart = 0; // percentage, 0...1
	mousePosition = { x: 0, y: 0 }; // pixels
	mouseDownPosition = { x: 0, y: 0 }; // pixels
	focusedTrack = 0;
	padding = 100;
	trackDropZone = -1;
	showPlayhead = true;
	invalidate = false;
	invalidateWaveform = false;
}

class ProgramState {
	canvasHeight = $state(1080);
	canvasWidth = $state(1920);
	timelineWidth = $state(0); // pixels
	duration = $state(1000); // frames
	currentFrame = $state(0);
	selectedClip = $state<Clip | null>(null);
	invalidateTimeline = false;
	playing = false;
}

export const appState = new AppState();
export const timelineState = new TimelineState();
export const programState = new ProgramState();
export const audioState = new AudioState();

export const historyManager = new HistoryManager();
export const projectManager = new ProjectManager();
export const workerManager = new WorkerManager();
