import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source.svelte';
import { appState } from '$lib/state.svelte';
import type { FileInfo, SourceType, Track } from '$lib/types';
import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

type ProjectTable = {
	id: string;
	name: string;
	height: number;
	width: number;
	aspect: number;
	tracks: Track[];
	duration: number;
	createdAt: number;
	lastModified: number;
};

type SourceTable = {
	id: string;
	projectId: string;
	type: SourceType;
	info: FileInfo;
	name: string;
	handle: FileSystemHandle | null;
	deleted: boolean;
	createdAt: number;
	lastModified: number;
};

type ClipTable = {
	id: string;
	projectId: string;
	sourceId: string;
	deleted: boolean;
	track: number;
	start: number;
	duration: number;
	sourceOffset: number;
	params: number[];
	createdAt: number;
	lastModified: number;
};

interface VideoEditorDB extends DBSchema {
	projects: {
		key: string;
		value: ProjectTable;
	};
	sources: {
		key: string;
		value: SourceTable;
		indexes: { 'by-project': string };
	};
	clips: {
		key: string;
		value: ClipTable;
		indexes: { 'by-project': string };
	};
	thumbnails: {
		key: number;
		value: { image: Blob; parentId: string; type: 'project' | 'source' };
		indexes: { 'by-parentId': string };
	};
}

export class ProjectManager {
	private dbName = 'VideoEditorDB';
	// Increment when schema changes
	private dbVersion = 1;
	private db: IDBPDatabase<VideoEditorDB> | null = null;

	async init() {
		this.db = await openDB(this.dbName, this.dbVersion, {
			upgrade(db) {
				// Delete existing stores
				const existingStores = Array.from(db.objectStoreNames);
				existingStores.forEach((storeName) => {
					db.deleteObjectStore(storeName);
				});
				// Create new ones
				db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
				const clipStore = db.createObjectStore('clips', { keyPath: 'id' });
				clipStore.createIndex('by-project', 'projectId');
				const sourceStore = db.createObjectStore('sources', { keyPath: 'id' });
				sourceStore.createIndex('by-project', 'projectId');
				//const thumbnailStore = db.createObjectStore('thumbnails');
				//thumbnailStore.createIndex('by-project', 'projectId');
				const store = db.createObjectStore('thumbnails', { keyPath: 'id', autoIncrement: true });
				store.createIndex('by-parentId', 'parentId');
			}
		});
	}

	async createProject(name: string) {
		if (!this.db) {
			console.error('db not ready');
			return;
		}
		const newProject: ProjectTable = {
			id: crypto.randomUUID(),
			name,
			tracks: [],
			height: 1080,
			width: 1920,
			aspect: 0,
			duration: 1800,
			createdAt: Date.now(),
			lastModified: Date.now()
		};
		const id = await this.db.add('projects', newProject as ProjectTable);
		return id;
	}

	async getAllProjects() {
		if (!this.db) return [];
		return await this.db.getAll('projects');
	}

	async getProjectCount() {
		if (!this.db) return 0;
		return await this.db.count('projects');
	}

	async deleteProject(projectId: string) {
		if (!this.db) return;
		const tx = this.db.transaction(['projects', 'clips', 'sources', 'thumbnails'], 'readwrite');

		const projectStore = tx.objectStore('projects');
		const clipStore = tx.objectStore('clips');
		const sourceStore = tx.objectStore('sources');
		const thumbnailStore = tx.objectStore('thumbnails');
		const clipIndex = clipStore.index('by-project');
		const sourceIndex = sourceStore.index('by-project');
		const thumbnailIndex = thumbnailStore.index('by-parentId');

		const clipKeys = await clipIndex.getAllKeys(projectId);
		const sourceKeys = await sourceIndex.getAllKeys(projectId);
		const thumbnailKeys = await thumbnailIndex.getAllKeys(projectId);

		await Promise.all([
			...clipKeys.map((key) => clipStore.delete(key)),
			...sourceKeys.map((key) => sourceStore.delete(key)),
			...thumbnailKeys.map((key) => thumbnailStore.delete(key)),
			projectStore.delete(projectId)
		]);

		await tx.done;
	}

	/**
	 * Returns the project with the most recent `lastModified` timestamp.
	 * Falls back to `createdAt` when `lastModified` is missing.
	 */
	async getLastModifiedProject() {
		if (!this.db) return;
		const projects = await this.db.getAll('projects');
		if (projects.length === 0) return;

		let last = projects[0];
		for (const project of projects) {
			const projectModifiedTime = project.lastModified;
			const lastTime = (last && last.lastModified) ?? 0;
			if (projectModifiedTime > lastTime) last = project;
		}
		return last;
	}

	async getProject(id: string) {
		if (!this.db) return;
		return await this.db.get('projects', id);
	}

	async updateProject(updates: Partial<ProjectTable>) {
		if (!this.db) return;
		const tx = this.db.transaction('projects', 'readwrite');
		const store = tx.objectStore('projects');
		const project = await store.get(appState.project.id);
		if (!project) throw new Error(`Project not found`);
		const updatedProject = {
			...project,
			...updates,
			lastModified: Date.now()
		};

		await store.put(updatedProject);
		await tx.done;
		return updatedProject;
	}

	async createSource(source: Source) {
		if (!this.db) return;
		const newSource: SourceTable = {
			id: source.id,
			projectId: appState.project.id,
			name: source.name,
			type: source.type,
			info: source.info,
			handle: source.handle ?? null,
			deleted: false,
			createdAt: Date.now(),
			lastModified: Date.now()
		};
		const id = await this.db.add('sources', newSource as SourceTable);
		return id;
	}

	async getProjectSources(projectId: string) {
		if (!this.db) return [];
		const sources = await this.db.getAllFromIndex('sources', 'by-project', projectId);
		return sources.sort((a, b) => a.createdAt - b.createdAt);
	}

	async getAllSources() {
		if (!this.db) return [];
		return await this.db.getAll('sources');
	}

	async updateSource(sourceId: string, updates: Partial<SourceTable>) {
		if (!this.db) return;
		const tx = this.db.transaction('sources', 'readwrite');
		const store = tx.objectStore('sources');
		const source = await store.get(sourceId);
		if (!source) throw new Error(`Source not found`);
		const updatedSource = {
			...source,
			...updates,
			lastModified: Date.now()
		};

		await store.put(updatedSource);
		await tx.done;
		return updatedSource;
	}

	async purgeDeletedSources() {
		if (!this.db) return;

		const tx = this.db.transaction(['sources', 'thumbnails'], 'readwrite');
		const sourceStore = tx.objectStore('sources');
		const thumbStore = tx.objectStore('thumbnails');
		const thumbIndex = thumbStore.index('by-parentId');

		let cursor = await sourceStore.openCursor();

		while (cursor) {
			if (cursor.value.deleted === true) {
				const sourceId = cursor.value.id;
				const thumbKeys = await thumbIndex.getAllKeys(sourceId);
				await Promise.all([...thumbKeys.map((key) => thumbStore.delete(key)), cursor.delete()]);
			}
			cursor = await cursor.continue();
		}

		await tx.done;
	}

	async createClip(clip: Clip) {
		if (!this.db) return;
		const newClip: ClipTable = {
			id: clip.id,
			projectId: appState.project.id,
			sourceId: clip.source.id,
			start: clip.start,
			sourceOffset: clip.sourceOffset,
			duration: clip.duration,
			track: clip.track,
			params: $state.snapshot(clip.params),
			deleted: false,
			createdAt: Date.now(),
			lastModified: Date.now()
		};
		const id = await this.db.add('clips', newClip as ClipTable);
		return id;
	}

	async getProjectClips(projectId: string) {
		if (!this.db) return [];
		return await this.db.getAllFromIndex('clips', 'by-project', projectId);
	}

	async updateClip(input: Clip | Clip[]) {
		if (!this.db) return;
		const updates = Array.isArray(input) ? input : [input];

		const tx = this.db.transaction('clips', 'readwrite');
		const store = tx.objectStore('clips');

		const missingClips: Clip[] = [];
		await Promise.all(
			updates.map(async (clip) => {
				if (!clip.id) throw new Error('Update missing id');

				const existing = await store.get(clip.id);
				if (!existing) {
					missingClips.push(clip);
					return null;
				}

				const merged = {
					...existing,
					track: clip.track,
					start: clip.start,
					sourceOffset: clip.sourceOffset,
					duration: clip.duration,
					params: $state.snapshot(clip.params),
					deleted: clip.deleted,
					lastModified: Date.now()
				};

				await store.put(merged);
				return merged;
			})
		);

		await tx.done;

		for (const clip of missingClips) {
			await this.createClip(clip);
		}
	}

	async purgeDeletedClips() {
		if (!this.db) return;

		const tx = this.db.transaction('clips', 'readwrite');
		const store = tx.objectStore('clips');
		let cursor = await store.openCursor();

		while (cursor) {
			if (cursor.value.deleted === true) await cursor.delete();
			cursor = await cursor.continue();
		}

		await tx.done;
	}

	/** Creates thumbnail record or updates if already exists */
	async createThumbnail(thumbnail: Blob, parentId: string, type: 'source' | 'project') {
		if (!this.db) return;

		const tx = this.db.transaction('thumbnails', 'readwrite');
		const store = tx.objectStore('thumbnails');
		const index = store.index('by-parentId');

		const existingKey = await index.getKey(parentId);

		const record = {
			image: thumbnail,
			parentId,
			type,
			...(existingKey !== undefined && { id: existingKey })
		};

		const id = await store.put(record);
		await tx.done;

		return id;
	}

	async getThumbnail(parentId: string) {
		if (!this.db) return;
		const tx = this.db.transaction('thumbnails', 'readonly');
		const store = tx.objectStore('thumbnails');
		const index = store.index('by-parentId');
		return await index.get(parentId);
	}

	async returnAll() {
		if (!this.db) return null;

		// Fetch everything in parallel
		const [projects, clips, sources, thumbnails] = await Promise.all([
			this.db.getAll('projects'),
			this.db.getAll('clips'),
			this.db.getAll('sources'),
			this.db.getAll('thumbnails')
		]);

		return { projects, clips, sources, thumbnails };
	}
}
