<script lang="ts">
	import * as core from '@diffusionstudio/core';
	import { onMount } from 'svelte';
	import { appState, timelineState, appHistory } from '$lib/state.svelte';

	import Project from '$lib/components/panels/Project.svelte';
	import Program from '$lib/components/panels/Program.svelte';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import Controls from '$lib/components/panels/Settings.svelte';
	import Palette from '$lib/components/palette/Palette.svelte';
	import { createTextSource } from '$lib/source/actions';

	//appState.composition = new core.Composition({ width: 1920, height: 1080 });

	$effect(() => {
		if (timelineState.playing) {
			//appState.composition?.play();
		} else {
			//appState.composition?.pause();
		}
	});

	onMount(async () => {
		createTextSource();
	});
</script>

<div class="h-dvh grid grid-cols-[25%_50%_25%] grid-rows-[55%_45%] bg-zinc-900">
	<div><Project /></div>
	<div><Program /></div>
	<div><Controls /></div>
	<div class="col-span-3"><Timeline /></div>
</div>

{#if appState.showPalette}
	<Palette />
{/if}

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Space':
				timelineState.playing = !timelineState.playing;
				break;

			case 'Escape':
				if (appState.showPalette) appState.showPalette = false;
				break;
		}
	}}
	onkeyup={(event) => {
		switch (event.code) {
			case 'KeyP':
				if (!appState.showPalette) appState.showPalette = true;
				break;
			case 'KeyZ':
				if (!event.ctrlKey) break;
				if (event.shiftKey) {
					appHistory.redo();
				} else {
					appHistory.undo();
				}

				break;
		}
	}}
/>
