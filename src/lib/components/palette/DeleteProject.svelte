<script lang="ts">
	import { closePalette } from '$lib/app/actions';
	import { deleteProject } from '$lib/project/actions';
	import { appState } from '$lib/state.svelte';
	import Button from '../ui/Button.svelte';

	const deleteAndLoadProject = async () => {
		appState.palette.shrink = 'h-30';
		appState.palette.page = 'projects';
		appState.palette.lock = true;
		appState.progress.started = true;
		appState.progress.percentage = 0;
		appState.progress.message = 'deleting project...';

		await deleteProject();

		appState.palette.lock = false;
		appState.progress.percentage = 100;
		setTimeout(() => closePalette(), 300);
	};
</script>

<div class="h-full flex flex-col px-8">
	<div class="flex-1 content-center">
		<div
			class="h-[5px] content-center text-zinc-100 starting:opacity-0 opacity-100 transition-opacity duration-400"
		>
			Are you sure you want to delete this project?
		</div>
	</div>
	<div class="flex-none pt-5 pb-7 text-right">
		<Button focusOnMount onclick={() => closePalette()} text="Cancel" />
		<Button
			className="ml-3"
			onclick={() => {
				deleteAndLoadProject();
			}}
			text="Delete"
		/>
	</div>
</div>
