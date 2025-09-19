<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import InfoIcon from '../icons/InfoIcon.svelte';
	import LogoIcon from '../icons/LogoIcon.svelte';

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

<div class="mx-8 flex-1 grow flex flex-col relative items-center">
	<LogoIcon class="text-rose-500 size-35 absolute -top-5 left-38" />
	<!-- <h1 class="text-7xl text-white font-semibold text-center mt-30">neli</h1> -->
	<svg
		class="text-white w-40 mt-35 mb-5"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 648.87 342.4"
		fill="currentColor"
	>
		<path
			class="cls-1"
			d="M10.78,328.87V121.74h52.5v207.13H10.78ZM147.77,328.87v-119.77c0-14.21-3.42-24.67-10.25-31.38-6.84-6.7-16-10.05-27.48-10.05-9.3,0-17.91,3.01-25.84,9.02-7.93,6.02-14.91,12.99-20.92,20.92v-46.35c4.37-5.74,9.64-11.28,15.79-16.61s13.19-9.7,21.12-13.12c7.93-3.42,16.54-5.13,25.84-5.13,14.21,0,26.93,3.15,38.14,9.43,11.21,6.29,20.03,15.79,26.46,28.51,6.42,12.71,9.64,28.51,9.64,47.37v127.15h-52.5Z"
		/>
		<path
			class="cls-1"
			d="M340.15,335.02c-15.32,0-29.67-2.6-43.07-7.79-13.4-5.19-25.29-12.64-35.68-22.35-10.39-9.7-18.46-21.12-24.2-34.25s-8.61-27.48-8.61-43.07c0-20.23,4.58-38.76,13.74-55.58,9.16-16.82,21.67-30.28,37.53-40.4,15.86-10.11,33.9-15.18,54.14-15.18s37.66,4.38,52.29,13.12c14.62,8.75,25.84,20.85,33.63,36.3,7.79,15.45,11.69,33.29,11.69,53.53v22.15h-154.63v-35.68h104.59c-.82-9.84-3.63-17.98-8.41-24.4-4.79-6.42-10.73-11.21-17.84-14.36-7.11-3.14-14.63-4.72-22.56-4.72-10.66,0-19.89,2.74-27.69,8.2-7.79,5.47-13.88,13.06-18.25,22.76-4.38,9.71-6.56,21.12-6.56,34.25,0,11.76,2.6,22.15,7.79,31.17,5.19,9.02,12.51,16.14,21.94,21.33,9.43,5.2,20.16,7.79,32.2,7.79,15.31,0,29.05-3.01,41.22-9.02,12.16-6.01,21.8-12.16,28.92-18.46v48.81c-4.38,3.83-10.25,7.73-17.64,11.69-7.38,3.97-15.73,7.32-25.02,10.05-9.3,2.73-19.14,4.1-29.53,4.1Z"
		/>
		<path class="cls-1" d="M461.99,328.87V33.55h52.5v295.31h-52.5Z" />
		<path
			class="cls-1"
			d="M549.78,166.44v-44.71h85.31v44.71h-85.31ZM603.92,84.41c-9.84,0-18.32-3.55-25.43-10.66-7.11-7.11-10.66-15.31-10.66-24.61,0-9.84,3.55-18.18,10.66-25.02,7.11-6.83,15.59-10.25,25.43-10.25,6.56,0,12.57,1.58,18.05,4.72,5.47,3.15,9.84,7.38,13.12,12.71s4.92,11.28,4.92,17.84c0,6.02-1.64,11.83-4.92,17.43-3.28,5.61-7.66,9.98-13.12,13.12-5.47,3.15-11.48,4.72-18.05,4.72ZM583,328.87V121.74h52.09v207.13h-52.09Z"
		/>
	</svg>
	<div class="text-zinc-500 font-semibold text-sm text-center">v{__VERSION__}</div>
	{#if errorMessage !== 'none'}
		<div class="text-rose-500 text-sm border border-rose-700 rounded-lg p-2 mt-4 flex items-center">
			<InfoIcon class="size-6 mr-2 text-rose-600" />
			<p class="flex-1 content-center">
				{#if errorMessage === 'webCodecs'}WebCodecs not supported{/if}
				{#if errorMessage === 'webGpu'}WebGpu not supported{/if}
			</p>
		</div>
	{:else}
		<div class="text-zinc-300 mt-10 text-center px-10">
			<p>
				Press <span class="text-sm px-1.5 py-0.5 rounded-sm bg-zinc-700">P</span> at any time to open
				the command pallete, where you can view menu options and learn shortcuts.
			</p>
		</div>
	{/if}

	<a href="https://github.com/edsunman/neli" target="_blank" aria-label="github repo">
		<svg
			class="size-8 mt-10 text-zinc-300 hover:text-white"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 98 96"
			fill="currentColor"
		>
			<path
				fill-rule="evenodd"
				clip-rule="evenodd"
				d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
			/>
		</svg>
	</a>
</div>

<svelte:window
	onkeyup={(event) => {
		switch (event.code) {
			case 'Backspace':
			case 'KeyP':
				if (appState.disableKeyboardShortcuts) break;
				appState.palettePage = 'search';
				break;
		}
	}}
/>
