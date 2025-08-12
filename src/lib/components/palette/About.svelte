<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { onMount } from 'svelte';

	let errorMessage = $state<'none' | 'webGpu' | 'webCodecs'>('none');

	onMount(() => {
		if (navigator && !navigator.gpu) {
			errorMessage = 'webGpu';
			console.error('WebGPU not supported');
		}
		if (!('VideoEncoder' in window && 'VideoDecoder' in window)) {
			errorMessage = 'webCodecs';
			console.error('WebCodecs not supported');
		}
	});
</script>

<div class="mx-8 flex-1 grow flex flex-col">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<h1 class="text-7xl text-white font-semibold text-center mt-30">neli</h1>
	<div class="text-zinc-500 font-semibold text-sm text-center">v{__VERSION__}</div>
	{#if errorMessage === 'webGpu'}
		<p class="text-white">WebGPU not supported</p>
	{/if}
	{#if errorMessage === 'webCodecs'}
		<p class="text-white">WebCodecs not supported</p>
	{/if}
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
