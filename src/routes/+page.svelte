<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { createTestSource, createTextSource } from '$lib/source/actions';
	import { setupTests } from '$lib/tests';
	import { loadFont } from '$lib/text/utils';
	import { focusTrack } from '$lib/timeline/actions';

	import Sources from '$lib/components/panels/Sources.svelte';
	import Program from '$lib/components/panels/Program.svelte';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import Controls from '$lib/components/panels/Settings.svelte';
	import Palette from '$lib/components/palette/Palette.svelte';
	import DragAndDropIcon from '$lib/components/misc/DragAndDropIcon.svelte';

	let sourcesMouseMove = $state<(e: MouseEvent) => void>();
	let sourcesMouseUp = $state<(e: MouseEvent) => void>();
	let timelineMouseMove = $state<(e: MouseEvent) => void>();
	let timelineMouseUp = $state<(e: MouseEvent) => void>();
	let programMouseMove = $state<(e: MouseEvent) => void>();
	let programMouseUp = $state<(e: MouseEvent) => void>();

	window.onmousemove = (e: MouseEvent) => {
		if (sourcesMouseMove) sourcesMouseMove(e);
		if (timelineMouseMove) timelineMouseMove(e);
		if (programMouseMove) programMouseMove(e);
	};

	window.onmouseup = (e: MouseEvent) => {
		if (timelineMouseUp) timelineMouseUp(e);
		if (programMouseUp) programMouseUp(e);
		if (sourcesMouseUp) sourcesMouseUp(e);
	};

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

		createTextSource();
		createTestSource();

		const font = await loadFont('/text.json');
		appState.fonts.push(font);

		setupTests();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id="portalContainer"
	class="relative overflow-hidden h-dvh grid grid-cols-[20%_60%_20%] xl:grid-cols-[20%_60%_20%] grid-rows-[55%_45%] height-xl:grid-rows-[calc(100svh-440px)_440px] bg-zinc-900"
>
	<div class="overflow-hidden">
		<Sources bind:mouseMove={sourcesMouseMove} bind:mouseUp={sourcesMouseUp} />
	</div>
	<div><Program bind:mouseMove={programMouseMove} bind:mouseUp={programMouseUp} /></div>
	<div><Controls /></div>
	<div class="col-span-3">
		<Timeline bind:mouseMove={timelineMouseMove} bind:mouseUp={timelineMouseUp} />
	</div>
	<DragAndDropIcon />
</div>

{#if appState.showPalette}
	<Palette />
{/if}

<svelte:window
	onkeyup={(event) => {
		switch (event.code) {
			case 'KeyP':
				if (appState.disableKeyboardShortcuts) break;
				if (!appState.showPalette) appState.showPalette = true;
				break;
			case 'KeyI':
				if (appState.disableKeyboardShortcuts) break;
				if (!appState.showPalette) {
					appState.palettePage = 'import';
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
			case 'KeyZ':
				if (!event.ctrlKey) break;
				focusTrack(0);
				if (event.shiftKey) {
					historyManager.redo();
				} else {
					historyManager.undo();
				}

				break;
		}
	}}
/>
