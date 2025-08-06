<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, historyManager } from '$lib/state.svelte';
	import { createTestSource, createTextSource } from '$lib/source/actions';

	import Sources from '$lib/components/panels/Sources.svelte';
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
		createTestSource();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="h-dvh grid grid-cols-[25%_50%_25%] xl:grid-cols-[20%_60%_20%] grid-rows-[55%_45%] bg-zinc-900"
	{onmousemove}
>
	<div><Sources /></div>
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
					historyManager.redo();
				} else {
					historyManager.undo();
				}

				break;
		}
	}}
/>
