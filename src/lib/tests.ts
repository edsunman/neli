/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClip } from './clip/actions';
//import { createSource } from './source/actions';
import { appState, projectManager /* timelineState, workerManager */ } from './state.svelte';
import { extendTimeline } from './timeline/actions';
/* import type { KeyframeTrack } from './types'; */
//import type { SourceType } from './types';

export const setupTests = () => {
	if (!window) return;

	// @ts-expect-error append function to window
	window.tests = {
		lotsOfClips,
		unlinkSources,
		auditDatabase /*  pushProject, login, pullProject  */
	};
};

/* const addKeyframes = () => {
	const clip = timelineState.clips[0];
	if (!clip) return;

	const newKeyframeTrack: KeyframeTrack = {
		frames: [0, 60],
		values: [0,1000]
	}

	clip.useKeyframes = [17];
	clip.keyframeTracks.set(17, newKeyframeTrack);
	workerManager.sendClip(clip);
} */

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
	const projectIds = new Set(projects.map((p: any) => p.id));
	const sourceIds = new Set(sources.map((s: any) => s.id));

	const orphans = {
		sourcesNoProject: sources.filter((s: any) => !projectIds.has(s.projectId)),
		clipsNoProject: clips.filter((c: any) => !projectIds.has(c.projectId)),
		clipsNoSource: clips.filter((c: any) => !sourceIds.has(c.sourceId)), // New Check
		thumbnailsNoParent: thumbnails.filter((t: any) => {
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
