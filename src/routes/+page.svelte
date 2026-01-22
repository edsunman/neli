<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { assignSourcesToFolders, createSource } from '$lib/source/actions';
	import { setupTests } from '$lib/tests';
	import { loadFont } from '$lib/text/utils';
	import { focusTrack } from '$lib/timeline/actions';
	import { showTimelineInProgram } from '$lib/program/actions';

	import Sources from '$lib/components/panels/Sources.svelte';
	import Program from '$lib/components/panels/Program.svelte';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import Properties from '$lib/components/panels/Properties.svelte';
	import Palette from '$lib/components/palette/Palette.svelte';
	import DragAndDropIcon from '$lib/components/misc/DragAndDropIcon.svelte';

	onMount(async () => {
		if (
			!localStorage.getItem('alreadyVisited') ||
			(navigator && !navigator.gpu) ||
			!('VideoEncoder' in window && 'VideoDecoder' in window)
		) {
			appState.showPalette = true;
			appState.palettePage = 'about';
			localStorage.setItem('alreadyVisited', 'true');
		}

		const textSource = createSource('text', { type: 'text' });
		textSource.preset = true;
		const testSource = createSource('test', { type: 'test' });
		testSource.preset = true;
		assignSourcesToFolders();

		const font = await loadFont('/text.json');
		appState.fonts.push(font);

		setupTests();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id="portalContainer"
	class="relative overflow-hidden h-dvh grid grid-cols-[20%_60%_20%] xl:grid-cols-[20%_60%_20%] grid-rows-[55%_45%] height-xl:grid-rows-[calc(100svh-392px)_392px] bg-zinc-900"
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

<div id="tooltipPortal" class="relative overflow-hidden z-8"></div>

{#if appState.showPalette}
	<Palette />
{/if}

<svelte:window
	onkeydown={(e) => {
		switch (e.code) {
			/* 			case 'Escape':
				if (appState.selectedSource && !appState.showPalette) {
					showTimelineInProgram();
				}
				break; */
			case 'KeyZ':
				e.preventDefault();
				if (!e.ctrlKey && !e.metaKey) break;
				focusTrack(0);
				timelineState.selectedClip = null;
				timelineState.selectedClips.clear();
				if (e.shiftKey) {
					historyManager.redo();
				} else {
					historyManager.undo();
				}

				break;
		}
	}}
	onkeyup={(e) => {
		switch (e.code) {
			case 'KeyP':
				if (appState.disableKeyboardShortcuts) break;
				if (!appState.showPalette) appState.showPalette = true;
				break;
			case 'KeyI':
				if (appState.disableKeyboardShortcuts) break;
				if (!appState.showPalette) {
					appState.palettePage = 'import';
					appState.import.importStarted = false;
					appState.showPalette = true;
				}
				break;
			case 'KeyE':
				if (appState.disableKeyboardShortcuts) break;
				if (!appState.showPalette) {
					appState.palettePage = 'export';
					appState.showPalette = true;
				}
				break;
		}
	}}
/>
