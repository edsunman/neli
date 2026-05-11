<script lang="ts">
	import { appState, historyManager } from '$lib/state.svelte';

	import Sources from '$lib/components/panels/Sources.svelte';
	import Program from '$lib/components/panels/Program.svelte';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import Properties from '$lib/components/panels/Properties.svelte';
	import Palette from '$lib/components/palette/Palette.svelte';
	import DragAndDropIcon from '$lib/components/misc/DragAndDropIcon.svelte';
</script>

<svelte:head>
	{#if appState.project.name}
		<title>
			neli &#8226; {appState.project.name}
		</title>
	{:else}
		<title>neli</title>
	{/if}
</svelte:head>

<div
	inert={appState.palette.open}
	id="portalContainer"
	class="relative overflow-hidden h-dvh grid grid-cols-[20%_60%_20%] xl:grid-cols-[20%_60%_20%] grid-rows-[55%_45%] height-xl:grid-rows-[calc(100svh-360px)_360px] bg-zinc-900"
>
	<div>
		<Sources />
	</div>
	<div><Program /></div>
	<div><Properties /></div>
	<div class="col-span-3">
		<Timeline />
	</div>
	<DragAndDropIcon />
</div>

<div id="tooltipPortal"></div>

{#if appState.palette.open}
	<Palette />
{/if}

<svelte:window
	onkeydown={(e) => {
		switch (e.code) {
			case 'KeyZ':
				if (!e.ctrlKey && !e.metaKey) break;
				e.preventDefault();
				//focusTrack(0);
				//deselectAllClips();
				if (e.shiftKey) {
					historyManager.redo();
				} else {
					historyManager.undo();
				}

				break;
		}
	}}
	onkeyup={(e) => {
		if (appState.disableKeyboardShortcuts) return;
		switch (e.code) {
			case 'KeyP':
				if (!appState.palette.open) {
					appState.palette.page = 'search';
					appState.palette.open = true;
				}
				break;
			case 'KeyN':
				if (!appState.palette.open) {
					appState.palette.page = 'import';
					appState.import.importStarted = false;
					appState.palette.open = true;
				}
				break;
			case 'KeyM':
				if (!appState.palette.open) {
					appState.palette.page = 'export';
					appState.palette.open = true;
				}
				break;
		}
	}}
/>
