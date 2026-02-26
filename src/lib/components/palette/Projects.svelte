<script lang="ts">
	import { appState, projectManager } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import TitleBar from './TitleBar.svelte';
	import { loadProject } from '$lib/project/actions';

	type Project = { id: number; name: string; createdAt: number; lastModified: number };

	let scrollDiv = $state<HTMLDivElement>();
	let projects = $state<(Project & { selected: boolean })[]>([]);

	let selectedIndex = 0;

	const selectById = (id: number) => {
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
		let projectId = 0;
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
		const dbProjects = (await projectManager.getAllProjects()) ?? [];
		projects = dbProjects.map((project, i): Project & { selected: boolean } => ({
			...project,
			selected: i === 0 ? true : false
		}));
	});
</script>

<TitleBar
	title="load project"
	onclick={() => {
		appState.palettePage = 'search';
	}}
/>
<div class="flex-1 bg-zinc-900 rounded-2xl overflow-y-hidden">
	<div
		bind:this={scrollDiv}
		class="px-8 overflow-y-scroll h-full"
		style="scrollbar-color: #52525c #18181b; scrollbar-width:thin"
	>
		{#each projects as project}
			<button
				id={`project-${project.id}`}
				onmousemove={() => {
					if (!project.selected) selectById(project.id);
				}}
				onclick={() => {
					loadProject(project.id);
				}}
				class={[
					'first:mt-4 last:mb-4 cursor-pointer w-full px-2 py-2.5 rounded-lg text-left flex items-center group',
					project.selected ? 'text-zinc-200 bg-hover' : ' text-zinc-200'
				]}
			>
				<p class="flex-1">{project.name}</p>
			</button>
		{/each}
	</div>
</div>
<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				if (appState.disableKeyboardShortcuts) break;
				appState.palettePage = 'search';
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
				for (const project of projects) {
					if (project.selected) {
						loadProject(project.id);
						appState.showPalette = false;
						break;
					}
				}
		}
	}}
/>
