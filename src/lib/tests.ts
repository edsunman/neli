import { createClip } from './clip/actions';
import { appState, projectManager } from './state.svelte';
import { extendTimeline } from './timeline/actions';
import { PUBLIC_API_URL, PUBLIC_R2_URL } from '$env/static/public';

export const setupTests = () => {
	//if (!window) return;

	// @ts-expect-error append function to window
	window.tests = {
		lotsOfClips,
		unlinkSources,
		auditDatabase,
		pushProject,
		login,
		pullProject,
		genrateUrl
	};
};

const login = async () => {
	const response = await fetch(`${PUBLIC_API_URL}/auth/login`, {
		method: 'POST',
		body: JSON.stringify({ email: 'test@test.com', password: 'password' }),
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' }
	});
	console.log(response);
};

const pushProject = async () => {
	const project = await projectManager.getProject(appState.project.id);
	if (!project) return;
	const sources = await projectManager.getProjectSources(appState.project.id);
	const clips = await projectManager.getProjectClips(appState.project.id);
	const keyframes = [];
	for (const clip of clips) {
		for (const [key, track] of Object.entries(clip.keyframeTracks)) {
			const keyNumber = Number(key);
			for (const keyframe of track.keyframes) {
				keyframes.push({
					clipId: clip.id,
					param: keyNumber,
					frame: keyframe.frame,
					value: keyframe.value,
					easeIn: keyframe.easeIn,
					easeOut: keyframe.easeOut
				});
			}
		}
	}

	const data = { sources, clips, keyframes, ...project };

	await fetch(`${PUBLIC_API_URL}/projects/${project?.id}`, {
		method: 'POST',
		body: JSON.stringify(data),
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' }
	});

	// upload files
	for (const source of sources) {
		if (
			(source.info.type === 'video' ||
				source.info.type === 'audio' ||
				source.info.type === 'image') &&
			source.handle
		) {
			const fileHandle = source.handle as FileSystemFileHandle;
			const file = await fileHandle.getFile();
			//const extension = getExtentionFromFileType(source.info.mimeType);
			//const fileName = `projects/${project.id}/sources/${source.id}${extension}`;
			const response = await fetch(`${PUBLIC_API_URL}/generate-upload-url`, {
				method: 'POST',
				body: JSON.stringify({ sourceId: source.id, fileType: source.info.mimeType }),
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' }
			});
			if (!response.ok) return;

			const { uploadUrl, fileName } = await response.json();
			console.log(`Uploading ${source.type}, ${source.id}`);
			await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: {
					'Content-Type': source.info.mimeType
				}
			});

			source.url = `${PUBLIC_R2_URL}/${fileName}`;
			console.log(`Upload done`);
		}
	}
};

const genrateUrl = async () => {
	const response = await fetch(`${PUBLIC_API_URL}/generate-upload-url`, {
		method: 'POST',
		body: JSON.stringify({ fileName: 'test.mp4', fileType: 'video/mp4' }),
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' }
	});

	if (response.ok) {
		console.log(await response.json());
	}
};

const pullProject = async () => {
	const response = await fetch(`${PUBLIC_API_URL}/projects/c67c6fbc-2104-41b0-a307-3bef500abd5c`, {
		method: 'GET'
	});
	if (response.ok) {
		const remoteProject = await response.json();
		const existingProject = await projectManager.getProject(remoteProject.id);

		if (existingProject) {
			console.log('project already exists');
			return;
		}

		projectManager.addRemoteProject(remoteProject);
		appState.projectCount++;
	}
};

const lotsOfClips = () => {
	extendTimeline(7500);
	const textSource = appState.sources.find((s) => s.type === 'text');
	const testSource = appState.sources.find((s) => s.type === 'test');
	if (!textSource || !testSource) return;
	for (let i = 0; i < 150; i++) {
		createClip(textSource.id, 1, i * 50, 50);
		createClip(testSource.id, 2, i * 50, 50);
	}
};

const unlinkSources = () => {
	for (const source of appState.sources) {
		source.unlinked = true;
	}
};

const auditDatabase = async () => {
	const data = await projectManager.returnAll();
	if (!data) return;

	const { projects, sources, clips, thumbnails } = data;
	const projectIds = new Set(projects.map((p) => p.id));
	const sourceIds = new Set(sources.map((s) => s.id));

	const orphans = {
		sourcesNoProject: sources.filter((s) => !projectIds.has(s.projectId)),
		clipsNoProject: clips.filter((c) => !projectIds.has(c.projectId)),
		clipsNoSource: clips.filter((c) => !sourceIds.has(c.sourceId)), // New Check
		thumbnailsNoParent: thumbnails.filter((t) => {
			if (t.type === 'project') return !projectIds.has(t.parentId);
			if (t.type === 'source') return !sourceIds.has(t.parentId);
			return true;
		})
	};

	console.log('--- Database Summary ---');
	console.log('Projects:', projects.length);
	console.log('Sources:', sources.length);
	console.log('Clips:', clips.length);
	console.log('Thumbnails:', thumbnails.length);

	const totalOrphans =
		orphans.sourcesNoProject.length +
		orphans.clipsNoProject.length +
		orphans.clipsNoSource.length +
		orphans.thumbnailsNoParent.length;

	if (totalOrphans === 0) {
		console.log('Status: Clean (0 orphans)');
	} else {
		console.log(`Status: Issues Found (${totalOrphans} orphans)`);

		if (orphans.sourcesNoProject.length > 0) {
			console.log('Orphan Sources (Missing Project):', orphans.sourcesNoProject);
		}

		if (orphans.clipsNoProject.length > 0) {
			console.log('Orphan Clips (Missing Project):', orphans.clipsNoProject);
		}

		if (orphans.clipsNoSource.length > 0) {
			console.log('Orphan Clips (Missing Source):', orphans.clipsNoSource);
		}

		if (orphans.thumbnailsNoParent.length > 0) {
			console.log('Orphan Thumbnails (Missing Parent):', orphans.thumbnailsNoParent);
		}
	}

	return { data, orphans };
};
/* const addSource = (type: SourceType, count = 1, name = 'test') => {
	for (let i = 0; i < count; i++) {
		//const newSource = createSource(type);
		//newSource.name = i + name;
		//appState.sources.push(newSource);
	}
}; */
