import { setAllJoins } from '$lib/clip/actions';
import { Clip } from '$lib/clip/clip.svelte';
import { resizeCanvas, showTimelineInProgram } from '$lib/program/actions';
import { assignSourcesToFolders, createSource, getSourceFromId } from '$lib/source/actions';
import { appState, historyManager, projectDatabase, timelineState } from '$lib/state.svelte';
import { pause, setAllTrackTypes, setTrackLocks, setTrackPositions } from '$lib/timeline/actions';
import { resetWorker, updateWorkerClip } from '$lib/worker/actions.svelte';

export const changeProjectResolution = (width: number, height: number) => {
	pause();
	showTimelineInProgram();
	appState.project.resolution.height = height;
	appState.project.resolution.width = width;
	projectDatabase.updateProject({ height, width });
	resizeCanvas(width, height);
};

//** Called on page load */
export const setupProjectDatabase = async () => {
	await projectDatabase.init();

	const lastProject = await projectDatabase.getLastModifiedProject();
	if (lastProject) {
		loadProject(lastProject.id);
		return;
	}

	createNewProject();
};

export const createNewProject = async () => {
	const name = 'untitled project';
	const id = await projectDatabase.createProject(name);
	if (!id) return;

	appState.project.id = id;
	appState.project.name = name;
	appState.project.aspect = 0;
	appState.project.resolution.height = 1920;
	appState.project.resolution.width = 1080;
	resizeCanvas(1920, 1080);

	appState.sources.length = 0;
	const textSource = createSource('text', { type: 'text' });
	await projectDatabase.createSource(textSource);
	const testSource = createSource('test', { type: 'test' });
	await projectDatabase.createSource(testSource);
	assignSourcesToFolders();

	timelineState.tracks.length = 0;
	for (let i = 0; i < 2; i++) {
		timelineState.tracks.push({
			height: 35,
			top: 0,
			lock: true,
			lockBottom: true,
			lockTop: true,
			type: 'none'
		});
	}
	setTrackPositions();
	await projectDatabase.updateProject({ tracks: timelineState.tracks });

	timelineState.clips.length = 0;
	timelineState.selectedClip = null;
	timelineState.invalidate = true;
};

export const loadProject = async (id: number) => {
	const project = await projectDatabase.getProject(id);
	if (!project) return;

	appState.project.id = project.id;
	appState.project.name = project.name;
	appState.project.resolution.width = project.width;
	appState.project.resolution.height = project.height;
	appState.project.aspect = project.aspect;
	resizeCanvas(project.width, project.height);

	resetWorker();
	appState.selectedSource = null;
	appState.sources.length = 0;
	const projectSources = await projectDatabase.getSources(id);
	for (const source of projectSources) {
		if (source.type === 'test' || source.type === 'text') {
			const newSource = createSource(source.type, source.info);
			newSource.id = source.id;
		}
	}
	assignSourcesToFolders();

	timelineState.tracks.length = 0;
	timelineState.tracks = Array.from(project.tracks);

	//setTrackPositions();

	timelineState.clips.length = 0;
	timelineState.selectedClip = null;
	await projectDatabase.purgeDeletedClips();
	const projectClips = await projectDatabase.getClips(id);
	for (const clip of projectClips) {
		const source = getSourceFromId(clip.sourceId);
		if (!source) return;
		const newClip = new Clip(source, clip.track, clip.start, clip.duration, 0);
		newClip.id = clip.id;
		timelineState.clips.push(newClip);
	}
	updateWorkerClip(timelineState.clips);
	setAllJoins();
	setAllTrackTypes();
	setTrackLocks();
	timelineState.invalidate = true;

	historyManager.reset();
};
