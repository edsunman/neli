<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import { fileIcon, infoIcon } from '../icons/Icons.svelte';
	import Button from '../ui/Button.svelte';
	import { closePalette, isViewportTooSmall } from '$lib/app/actions';

	let { onSelect } = $props();

	let errorMessage = $state<'none' | 'webGpu' | 'webCodecs' | 'screenSize'>('none');
	let firstVisit = $state(false);

	onMount(() => {
		if (navigator && !navigator.gpu) {
			errorMessage = 'webGpu';
		}
		if (!('VideoEncoder' in window && 'VideoDecoder' in window)) {
			errorMessage = 'webCodecs';
		}
		if (isViewportTooSmall()) {
			errorMessage = 'screenSize';
		}
		if (!localStorage.getItem('alreadyVisited')) {
			firstVisit = true;
			localStorage.setItem('alreadyVisited', 'true');
		}
	});
</script>

<div class="px-8 bg-zinc-900 rounded-2xl flex-1 grow flex flex-col relative items-center">
	<svg
		class={[firstVisit ? 'mt-12' : 'height-md:mt-20 mt-10', 'text-white w-40 mb-5']}
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 648.87 342.4"
		fill="currentColor"
	>
		<path
			class="cls-1"
			d="M18.06,322.94v-194.79h57.13v194.79H18.06ZM143.44,322.94l-.38-111.2c0-11.5-2.88-19.81-8.63-24.92-5.75-5.11-12.98-7.67-21.67-7.67-7.93,0-15.02,2.3-21.28,6.9-6.27,4.6-11.69,10.1-16.3,16.49v-47.55c4.09-5.62,8.95-10.86,14.57-15.72,5.62-4.85,11.95-8.75,18.98-11.69,7.03-2.94,14.89-4.41,23.58-4.41,13.29,0,25.12,2.94,35.47,8.82,10.35,5.88,18.46,14.76,24.35,26.65,5.88,11.89,8.82,26.65,8.82,44.29v120.02h-57.52Z"
		/><path
			class="cls-1"
			d="M331.34,328.69c-14.06,0-27.42-2.37-40.07-7.09-12.65-4.73-23.97-11.5-33.93-20.32-9.97-8.82-17.77-19.42-23.39-31.83-5.62-12.4-8.44-26.13-8.44-41.22,0-19.17,4.34-36.68,13.04-52.53,8.69-15.85,20.71-28.57,36.04-38.15s32.59-14.38,51.76-14.38,35.34,4.09,49.27,12.27c13.93,8.18,24.73,19.5,32.4,33.94,7.67,14.44,11.5,31.51,11.5,51.19v21.86h-141.49v-36.81h86.66c-.26-7.67-2.37-14.06-6.33-19.17-3.97-5.11-8.89-8.88-14.76-11.31-5.88-2.43-12.02-3.64-18.41-3.64-8.95,0-16.68,2.24-23.2,6.71-6.52,4.48-11.63,10.93-15.34,19.36-3.71,8.44-5.56,18.66-5.56,30.68,0,10.23,2.23,19.11,6.71,26.65,4.47,7.54,10.8,13.23,18.98,17.06,8.18,3.83,17.25,5.75,27.22,5.75,14.57,0,27.42-2.43,38.54-7.29,11.12-4.85,19.75-9.46,25.88-13.8v50.62c-4.09,3.33-9.59,6.65-16.49,9.97-6.9,3.33-14.64,6.07-23.2,8.24-8.57,2.17-17.7,3.26-27.42,3.26Z"
		/><path class="cls-1" d="M444.09,322.94V46.86h57.13v276.08h-57.13Z" /><path
			class="cls-1"
			d="M531.92,176.08v-47.93h88.96v47.93h-88.96ZM586.75,95.94c-10.23,0-19.05-3.58-26.46-10.74-7.42-7.15-11.12-15.72-11.12-25.69s3.7-18.85,11.12-25.88c7.41-7.03,16.23-10.54,26.46-10.54,6.64,0,12.84,1.67,18.6,4.98,5.75,3.33,10.35,7.73,13.8,13.23,3.45,5.5,5.18,11.57,5.18,18.21s-1.73,12.4-5.18,18.02c-3.45,5.63-8.05,10.1-13.8,13.42-5.75,3.32-11.95,4.98-18.6,4.98ZM563.36,322.94v-194.79h57.52v194.79h-57.52Z"
		/>
	</svg>
	<div class="text-zinc-500 font-semibold text-sm text-center">
		v{__VERSION__}
		<span class="ml-2 bg-zinc-600 p-1 py-0.5 rounded-sm text-zinc-900 font-extralight"
			>pre-alpha</span
		>
	</div>
	{#if errorMessage !== 'none'}
		<div
			class="text-rose-500 text-sm border-2 border-rose-900 rounded-lg p-2 mt-10 mb-20 flex items-center"
		>
			{@render infoIcon('size-6 mr-2 text-rose-600 ')}
			<p class="flex-1 content-center font-bold">
				{#if errorMessage === 'webCodecs'}WebCodecs not supported{/if}
				{#if errorMessage === 'webGpu'}WebGpu not supported{/if}
				{#if errorMessage === 'screenSize'}Neli is designed for larger screens{/if}
			</p>
		</div>
	{:else}
		{#if firstVisit}
			<div class="mt-10">
				<Button
					large
					onclick={() => closePalette()}
					text="Start new project"
					icon={fileIcon}
					className="w-70 text-left"
				/>
			</div>
		{/if}
		<div
			class={[
				firstVisit ? 'mt-18' : 'mt-24',
				'text-zinc-300 mt-18 mb-10 text-center px-10 text-sm'
			]}
		>
			<p>
				Press
				<span class="text-sm mx-1 px-1.5 py-0.5 rounded-sm border border-zinc-500">P</span> at any time
				to open the command pallete, where you can view menu options and learn shortcuts.
			</p>
		</div>
	{/if}

	<a href="https://github.com/edsunman/neli" target="_blank" aria-label="github repo">
		<svg
			class="size-8 text-zinc-300 hover:text-white"
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
				appState.palette.page = 'search';
				onSelect();
				break;
		}
	}}
/>
