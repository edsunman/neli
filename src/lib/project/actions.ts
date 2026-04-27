import { deselectAllClips, setAllJoins } from '$lib/clip/actions';
import { Clip } from '$lib/clip/clip.svelte';
import { resizeCanvas, showTimelineInProgram } from '$lib/program/actions';
import {
	assignSourcesToFolders,
	createImageSource,
	createSource,
	createThumbnailBlob,
	downloadToOPFS,
	getExtentionFromFileType,
	getSourceFromId,
	relinkFile,
	setSourceThumbnail
} from '$lib/source/actions';
import {
	appState,
	historyManager,
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
import { PUBLIC_R2_URL } from '$env/static/public';

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
	await projectManager.updateProject({ tracks: ['none', 'none'] });

	timelineState.clips.length = 0;
	deselectAllClips();
	timelineState.invalidate = true;
};

export const loadProject = async (id: string) => {
	pause();

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
		newSource.url = source.url;
		if (
			(source.info.type === 'video' ||
				source.info.type === 'audio' ||
				source.info.type === 'image') &&
			source.url
		) {
			const extention = getExtentionFromFileType(source.info.mimeType);
			if (!extention) throw new Error('invalid extention');
			const fileName = source.id + extention;
			let handle = await getFileHandleFromOPFS(fileName);
			if (!handle) {
				// no local copy so need to download
				const url = `${PUBLIC_R2_URL}/${source.url}`;
				handle = await downloadToOPFS(url, fileName);
			}
			if (handle) {
				source.handle = handle;
				newSource.handle = handle;
				//await projectManager.updateSource(source.id, { handle });
			}
		}

		if (source.type === 'video' || source.type === 'image') {
			const thumbnailData = await projectManager.getThumbnail(source.id);
			if (thumbnailData) setSourceThumbnail(source.id, thumbnailData.image);
		}

		if (source.type === 'video' || source.type === 'audio') {
			newSource.unlinked = true;
			if (source.handle && source.handle.kind === 'file') {
				//const permission = await source.handle.queryPermission({ mode: 'read' });
				const permission = source.handle.queryPermission
					? await source.handle.queryPermission({ mode: 'read' })
					: 'granted'; // Default to granted for Firefox/OPFS

				if (permission === 'granted') {
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
			const handle = await getFileHandleFromOPFS(fileName);
			if (handle) {
				const file = await handle.getFile();
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
	for (let i = 0; i < project.tracks.length; i++) {
		timelineState.tracks.push({
			height: 35,
			top: 0,
			lock: true,
			lockBottom: true,
			lockTop: true,
			type: project.tracks[i]
		});
	}
	timelineState.showPlayhead = true;
	focusTrack(0);
	setTrackPositions();

	timelineState.clips.length = 0;
	deselectAllClips(false);
	await projectManager.purgeDeletedClips();
	const projectClips = await projectManager.getProjectClips(id);
	let lastFrame = 0;
	for (const clip of projectClips) {
		const source = getSourceFromId(clip.sourceId);
		if (!source) continue;
		const newClip = new Clip(source, clip.track, clip.start, clip.duration, clip.sourceOffset);
		newClip.id = clip.id;
		newClip.params = clip.params;
		newClip.text = clip.text;
		if (clip.keyframeTracks) {
			newClip.keyframeTracks = new Map(
				Object.entries(clip.keyframeTracks).map(([key, track]) => [Number(key), track])
			);
			newClip.keyframeTracksActive = Object.keys(clip.keyframeTracks).map((n) => Number(n));
		}
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

const getFileHandleFromOPFS = async (fileName: string) => {
	const root = await navigator.storage.getDirectory();
	let handle;
	try {
		handle = await root.getFileHandle(fileName, { create: false });
	} catch {
		console.log('File not found');
		return;
	}
	return handle;
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
