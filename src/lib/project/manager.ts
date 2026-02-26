import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source.svelte';
import { appState } from '$lib/state.svelte';
import type { FileInfo, SourceType, Track } from '$lib/types';
import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

type ProjectTable = {
	id: number;
	name: string;
	height: number;
	width: number;
	aspect: number;
	tracks: Track[];
	createdAt: number;
	lastModified: number;
};

type SourceTable = {
	id: string;
	projectId: number;
	type: SourceType;
	info: FileInfo;
	name: string;
	createdAt: number;
	lastModified: number;
};

type ClipTable = {
	id: string;
	projectId: number;
	sourceId: string;
	deleted: boolean;
	track: number;
	start: number;
	duration: number;
	createdAt: number;
	lastModified: number;
};

interface VideoEditorDB extends DBSchema {
	projects: {
		key: number;
		value: ProjectTable;
	};
	sources: {
		key: number;
		value: SourceTable;
		indexes: { 'by-project': number };
	};
	clips: {
		key: string;
		value: ClipTable;
		indexes: { 'by-project': number };
	};
}

export class ProjectManager {
	private dbName = 'VideoEditorDB';
	private dbVersion = 1;
	private db: IDBPDatabase<VideoEditorDB> | null = null;

	async init() {
		this.db = await openDB(this.dbName, this.dbVersion, {
			upgrade(db) {
				db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });

				const clipStore = db.createObjectStore('clips', { keyPath: 'id' });
				clipStore.createIndex('by-project', 'projectId');

				const sourceStore = db.createObjectStore('sources', { keyPath: 'id' });
				sourceStore.createIndex('by-project', 'projectId');
			}
		});
	}

	async createProject(name: string) {
		if (!this.db) {
			console.error('db not ready');
			return;
		}
		const newProject: Omit<ProjectTable, 'id'> = {
			name,
			tracks: [],
			height: 1080,
			width: 1920,
			aspect: 0,
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

	async getProject(id: number) {
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
			createdAt: Date.now(),
			lastModified: Date.now()
		};
		const id = await this.db.add('sources', newSource as SourceTable);
		return id;
	}

	async getSources(projectId: number) {
		if (!this.db) return [];
		const sources = await this.db.getAllFromIndex('sources', 'by-project', projectId);
		return sources.sort((a, b) => a.createdAt - b.createdAt);
	}

	async createClip(clip: Clip) {
		if (!this.db) return;
		const newClip: ClipTable = {
			id: clip.id,
			projectId: appState.project.id,
			sourceId: clip.source.id,
			start: clip.start,
			duration: clip.duration,
			track: clip.track,
			deleted: false,
			createdAt: Date.now(),
			lastModified: Date.now()
		};
		const id = await this.db.add('clips', newClip as ClipTable);
		return id;
	}

	async getClips(projectId: number) {
		if (!this.db) return [];
		return await this.db.getAllFromIndex('clips', 'by-project', projectId);
	}

	async updateClip(input: Clip | Clip[]) {
		if (!this.db) return;
		const updates = Array.isArray(input) ? input : [input];

		const tx = this.db.transaction('clips', 'readwrite');
		const store = tx.objectStore('clips');

		await Promise.all(
			updates.map(async (clip) => {
				if (!clip.id) throw new Error('Update missing id');

				const existing = await store.get(clip.id);
				if (!existing) return null;

				const merged = {
					...existing,
					track: clip.track,
					start: clip.start,
					duration: clip.duration,
					deleted: clip.deleted,
					lastModified: Date.now()
				};

				await store.put(merged);
				return merged;
			})
		);

		await tx.done;
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
}
