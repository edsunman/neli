<script lang="ts">
	import { appState, projectManager } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import { createProjectThumbnail, loadProject } from '$lib/project/actions';
	import ProgressBar from './ProgressBar.svelte';
	import { closePalette } from '$lib/app/actions';
	import { getRelativeTime } from '$lib/project/utils';

	type Project = {
		id: string;
		name: string;
		createdAt: number;
		lastModified: number;
		selected: boolean;
		thumbnail: string;
	};

	let scrollDiv = $state<HTMLDivElement>();
	let projects = $state<Project[]>([]);

	let selectedIndex = 1;

	const selectProject = async (id: string) => {
		if (appState.project.id === id) {
			closePalette();
			return;
		}
		appState.progress.started = true;
		appState.progress.percentage = 0;
		appState.progress.message = 'loading project...';
		appState.palette.shrink = 'h-30';
		appState.palette.lock = true;
		await loadProject(id);
		appState.palette.lock = false;
		closePalette();
	};

	const selectById = (id: string) => {
		let i = -1;
		projects.forEach((project) => {
			if (project.selected) project.selected = false;
			if (project.id === id) {
				project.selected = true;
				selectedIndex = i;
			}
			i++;
		});
	};

	const selectByIndex = (index: number) => {
		if (index < 0) {
			index = projects.length - 1;
		}
		if (projects.length < index + 1) {
			index = 0;
		}
		let i = 0;
		let projectId = '';
		projects.forEach((project) => {
			if (project.selected) project.selected = false;
			if (index === i) {
				project.selected = true;
				selectedIndex = index;
				projectId = project.id;
			}
			i++;
		});
		// keyboard scroll
		const element = document.getElementById(`project-${projectId}`);
		if (!element || !scrollDiv) return;
		const rect = element.getBoundingClientRect();
		const scrollRect = scrollDiv.getBoundingClientRect();
		if (rect.bottom > scrollRect.bottom) {
			element.scrollIntoView(false);
		}
		if (rect.top < scrollRect.top) {
			element.scrollIntoView();
		}
	};

	onMount(async () => {
		const dbProject = await projectManager.getProject(appState.project.id);
		if (!dbProject) return;
		const dbProjects = (await projectManager.getAllProjects()) ?? [];
		projects = dbProjects
			.sort((a, b) => b.lastModified - a.lastModified)
			.map(
				(project, i): Project => ({
					...project,
					selected: i === selectedIndex ? true : false,
					thumbnail: ''
				})
			);
		for (let i = 0; i < projects.length; i++) {
			if (projects[i].id === appState.project.id) {
				const blob = await createProjectThumbnail();
				projects[i].thumbnail = URL.createObjectURL(blob);
				continue;
			}
			const thumbnailData = await projectManager.getThumbnail(projects[i].id);
			if (!thumbnailData) continue;
			projects[i].thumbnail = URL.createObjectURL(thumbnailData.image);
		}
	});
</script>

{#if appState.progress.started}
	<div class="h-full p-8 content-center w-full">
		<ProgressBar />
	</div>
{:else}
	<div
		bind:this={scrollDiv}
		class="px-8 overflow-y-scroll h-full gap-1 flex flex-col"
		style="scrollbar-color: #52525c #18181b; scrollbar-width:thin"
	>
		{#each projects as project (project.id)}
			<button
				id={`project-${project.id}`}
				onmousemove={() => {
					if (!project.selected) selectById(project.id);
				}}
				onclick={() => {
					selectProject(project.id);
				}}
				class={[
					'first:mt-4 last:mb-4 cursor-pointer w-full px-2 py-2.5 rounded-lg flex items-center group',
					project.selected ? 'text-white bg-hover' : ' text-zinc-400'
				]}
			>
				<span
					style:background-image={`url(${project.thumbnail})`}
					class={[
						project.thumbnail ? 'opacity-100' : 'opacity-0',
						'h-10 w-14 mr-4 flex flex-wrap justify-center content-center top-2 left-2 rounded-lg ',
						'bg-cover bg-center transition-opacity duration-200'
					]}
				></span>
				<span class="flex-1 text-left text-sm truncate mr-4">{project.name}</span>
				<span class={['text-sm ', project.selected ? 'text-zinc-500' : ' text-zinc-700']}>
					{#if appState.project.id === project.id}
						open now
					{:else}
						{getRelativeTime(project.lastModified)}
					{/if}
				</span>
			</button>
		{/each}
	</div>
{/if}

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				if (appState.disableKeyboardShortcuts || appState.progress.started) break;
				appState.palette.page = 'search';
				break;
			case 'ArrowDown':
				event.preventDefault();
				selectByIndex(selectedIndex + 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectByIndex(selectedIndex - 1);
				break;
			case 'Enter':
				event.preventDefault();
				if (appState.progress.started) break;
				for (const project of projects) {
					if (project.selected) {
						selectProject(project.id);
						break;
					}
				}
		}
	}}
/>
