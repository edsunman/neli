<script lang="ts">
	import * as core from '@diffusionstudio/core';
	import { appState, timelineState } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import { createSource } from '$lib/timeline/actions';

	let element = $state<HTMLDivElement>();
	let width = $state(0);
	let height = $state(0);
	let scale = $state(35);

	onMount(async () => {
		if (!element || !appState.composition) return;

		appState.composition.mount(element);
		//'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
		/* createSource(
			'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
		); */
		createSource('/30p.mp4');
	});
</script>

<div class="h-full relative overflow-hidden" bind:clientHeight={height} bind:clientWidth={width}>
	<div
		class="absolute"
		style:top={`${height / 2 - 540}px`}
		style:left={`${width / 2 - 960}px`}
		style:transform={`scale(${scale}%)`}
		bind:this={element}
	></div>
</div>
