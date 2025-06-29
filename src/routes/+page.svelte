<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, timelineState, appHistory } from '$lib/state.svelte';
	import { createTextSource } from '$lib/source/actions';

	import Project from '$lib/components/panels/Project.svelte';
	import Program from '$lib/components/panels/Program.svelte';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import Controls from '$lib/components/panels/Settings.svelte';
	import Palette from '$lib/components/palette/Palette.svelte';

	let timelineMouseMove = $state<(e: MouseEvent, x: number, y: number) => void>();
	let timelineMouseUp = $state<(e: MouseEvent) => void>();
	let programMouseMove = $state<(e: MouseEvent, x: number, y: number) => void>();

	const onmousemove = (e: MouseEvent) => {
		if (timelineMouseMove) timelineMouseMove(e, e.clientX, e.clientY);
		if (programMouseMove) programMouseMove(e, e.clientX, e.clientY);
	};

	window.onmouseup = (e: MouseEvent) => {
		if (timelineMouseUp) timelineMouseUp(e);
	};

	onMount(async () => {
		createTextSource();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="h-dvh grid grid-cols-[25%_50%_25%] grid-rows-[55%_45%] bg-zinc-900" {onmousemove}>
	<div><Project /></div>
	<div><Program bind:mouseMove={programMouseMove} /></div>
	<div><Controls /></div>
	<div class="col-span-3">
		<Timeline bind:mouseMove={timelineMouseMove} bind:mouseUp={timelineMouseUp} />
	</div>
</div>

{#if appState.showPalette}
	<Palette />
{/if}

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
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
