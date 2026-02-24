<script lang="ts">
	import { appState, projectDatabase } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import TitleBar from './TitleBar.svelte';
	import { loadProject } from '$lib/project/actions';

	type Project = { id: number; name: string; createdAt: number; lastModified: number };

	let projects = $state<Project[]>([]);

	onMount(async () => {
		projects = (await projectDatabase.getAllProjects()) ?? [];
	});
</script>

<TitleBar
	title="load project"
	onclick={() => {
		appState.palettePage = 'search';
	}}
/>
<div class="flex-1 px-8 bg-zinc-900 rounded-2xl grow flex flex-col">
	{#each projects as project}
		<button
			onclick={() => {
				loadProject(project.id);
			}}
			class={[
				'cursor-pointer w-full px-2 py-2.5 rounded-lg text-left flex items-center group',
				1 === 1 ? 'text-zinc-200 bg-hover' : ' text-zinc-200'
			]}
		>
			<p class="flex-1">{project.name}</p>
		</button>
	{/each}
</div>
<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				if (appState.disableKeyboardShortcuts) break;
				appState.palettePage = 'search';
				break;
		}
	}}
/>
