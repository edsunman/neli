<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import InfoIcon from '../icons/InfoIcon.svelte';

	let errorMessage = $state<'none' | 'webGpu' | 'webCodecs'>('none');

	onMount(() => {
		if (navigator && !navigator.gpu) {
			errorMessage = 'webGpu';
		}
		if (!('VideoEncoder' in window && 'VideoDecoder' in window)) {
			errorMessage = 'webCodecs';
		}
	});
</script>

<div class="mx-8 flex-1 grow flex flex-col">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<h1 class="text-7xl text-white font-semibold text-center mt-30">neli</h1>
	<div class="text-zinc-500 font-semibold text-sm text-center">v{__VERSION__}</div>
	{#if errorMessage !== 'none'}
		<div class="text-rose-500 text-sm border border-rose-700 rounded-lg p-2 mt-4 flex items-center">
			<InfoIcon class="size-6 mr-2 text-rose-600" />
			<p class="flex-1 content-center">
				{#if errorMessage === 'webCodecs'}WebCodecs not supported{/if}
				{#if errorMessage === 'webGpu'}WebGpu not supported{/if}
			</p>
		</div>
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
