import { deselectAllClips, setAllJoins } from '$lib/clip/actions';
import { Clip } from '$lib/clip/clip.svelte';
import { resizeCanvas, showTimelineInProgram } from '$lib/program/actions';
import {
	assignSourcesToFolders,
	createImageSource,
	createSource,
	createThumbnailBlob,
	getSourceFromId,
	relinkFile,
	setSourceThumbnail
} from '$lib/source/actions';
import {
	appState,
	historyManager,
	programState,
	projectManager,
	timelineState,
	workerManager
} from '$lib/state.svelte';
import {
	extendTimeline,
	focusTrack,
	pause,
	setTrackPositions,
	setZoom
} from '$lib/timeline/actions';
import { getNextProjectName } from './utils';

export const changeProjectResolution = (width: number, height: number) => {
	pause();
	showTimelineInProgram();
	appState.project.resolution.height = height;
	appState.project.resolution.width = width;
	projectManager.updateProject({ height, width });
	resizeCanvas(width, height);
};

/** Called on page load */
export const setupProjectManager = async () => {
	await projectManager.init();

	appState.projectCount = await projectManager.getProjectCount();

	const lastProject = await projectManager.getLastModifiedProject();
	if (lastProject) {
		await loadProject(lastProject.id);
		return;
	}

	createNewProject();
};

export const createNewProject = async () => {
	const projects = await projectManager.getAllProjects();
	const projectNames = projects.map((project) => {
		return project.name;
	});
	const name = getNextProjectName(projectNames);
	const id = await projectManager.createProject(name);
	if (!id) return;
	appState.projectCount++;

	appState.project.id = id;
	appState.project.name = name;
	appState.project.aspect = 0;
	appState.project.resolution.height = 1080;
	appState.project.resolution.width = 1920;
	appState.propertiesSection = 'project';
	resizeCanvas(1920, 1080);
	workerManager.reset();

	appState.sources.length = 0;
	const textSource = createSource('text', { type: 'text' });
	await projectManager.createSource(textSource);
	const testSource = createSource('test', { type: 'test' });
	await projectManager.createSource(testSource);
	assignSourcesToFolders();

	timelineState.currentFrame = 0;
	timelineState.duration = 1800;
	setZoom(0.9);
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
	await projectManager.updateProject({ tracks: timelineState.tracks });

	timelineState.clips.length = 0;
	deselectAllClips();
	timelineState.invalidate = true;
};

export const loadProject = async (id: string) => {
	const project = await projectManager.getProject(id);
	if (!project) return;

	appState.progress.message = 'loading project...';

	appState.project.id = project.id;
	appState.project.name = project.name;
	appState.project.resolution.width = project.width;
	appState.project.resolution.height = project.height;
	appState.project.aspect = project.aspect;
	appState.propertiesSection = 'project';
	appState.selectedSource = null;
	resizeCanvas(project.width, project.height);
	workerManager.reset();

	appState.selectedSource = null;
	appState.sources.length = 0;
	await projectManager.purgeDeletedSources();
	await cleanOPFS();
	const projectSources = await projectManager.getProjectSources(id);
	let i = 0;
	for (const source of projectSources) {
		const newSource = createSource(source.type, source.info);
		newSource.id = source.id;
		newSource.name = source.name;

		if (source.type === 'video' || source.type === 'image') {
			const thumbnailData = await projectManager.getThumbnail(source.id);
			if (thumbnailData) setSourceThumbnail(source.id, thumbnailData.image);
		}

		if (source.type === 'video' || source.type === 'audio') {
			newSource.unlinked = true;
			if (source.handle && source.handle.kind === 'file') {
				const permission = await source.handle.queryPermission({ mode: 'read' });
				if (permission == 'granted') {
					const fileHandle = source.handle as FileSystemFileHandle;
					try {
						const file = await fileHandle.getFile();
						await relinkFile(file, newSource);
					} catch {
						console.log(`Unable to load file from handle: ${fileHandle.name}`);
					}
				}
			}
			if (source.handle) newSource.handle = source.handle;
		}

		if (source.info.type === 'image') {
			// check opfs for image
			const fileName = `${source.id}.${source.info.extention}`;
			const file = await getFileFromOPFS(fileName);
			if (file) {
				await createImageSource(file, source.info, newSource);
			} else {
				newSource.unlinked = true;
			}
		}

		appState.progress.percentage = (i / projectSources.length) * 100;
		i++;
	}
	assignSourcesToFolders();

	timelineState.currentFrame = 0;
	timelineState.tracks.length = 0;
	timelineState.tracks = Array.from(project.tracks);
	timelineState.showPlayhead = true;
	focusTrack(0);
	setTrackPositions();

	timelineState.clips.length = 0;
	deselectAllClips();
	await projectManager.purgeDeletedClips();
	const projectClips = await projectManager.getProjectClips(id);
	let lastFrame = 0;
	for (const clip of projectClips) {
		const source = getSourceFromId(clip.sourceId);
		if (!source) continue;
		const newClip = new Clip(source, clip.track, clip.start, clip.duration, clip.sourceOffset);
		newClip.id = clip.id;
		newClip.params = clip.params;
		timelineState.clips.push(newClip);
		const lastClipFrame = clip.start + clip.duration;
		if (lastClipFrame > lastFrame) lastFrame = lastClipFrame;
	}
	workerManager.sendClip(timelineState.clips);
	setAllJoins();
	timelineState.duration = 1800;
	extendTimeline(lastFrame);
	setZoom(0.9);
	timelineState.invalidate = true;

	historyManager.reset();
	appState.progress.percentage = 100;
};

export const deleteProject = async () => {
	await projectManager.deleteProject(appState.project.id);
	appState.projectCount--;
	const lastProject = await projectManager.getLastModifiedProject();
	if (lastProject) await loadProject(lastProject.id);
};

export const createProjectThumbnail = async () => {
	const { bitmap } = await workerManager.getThumbnail();
	const blob = await createThumbnailBlob(bitmap, bitmap.width, bitmap.height);
	projectManager.createThumbnail(blob, appState.project.id, 'project');
	bitmap.close();
	return blob;
};

const getFileFromOPFS = async (fileName: string) => {
	const root = await navigator.storage.getDirectory();
	let handle;
	try {
		handle = await root.getFileHandle(fileName, { create: false });
	} catch (e) {
		console.error(e);
		return;
	}
	return handle.getFile();
};

/** Removes files with id that has no matching source in db */
const cleanOPFS = async () => {
	const sources = await projectManager.getAllSources();
	const sourceIds = new Set(sources.map((s) => s.id));
	const root = await navigator.storage.getDirectory();

	for await (const [name, handle] of root.entries()) {
		if (handle.kind !== 'file') continue;
		const idFromFilename = name.substring(0, name.lastIndexOf('.')) || name;

		if (!sourceIds.has(idFromFilename)) {
			await root.removeEntry(name);
		}
	}
};
