<script lang="ts">
	import { Progress, useId } from 'bits-ui';
	import { appState } from '$lib/state.svelte';
	import { encode } from '$lib/worker/actions.svelte';
	import Button from '../ui/Button.svelte';
	import Input from '../ui/Input.svelte';
	import { getUsedTimelineDuration } from '$lib/timeline/actions';

	let { shrinkBox } = $props();

	let inputValue = $state('');
	let encodingStarted = $state(false);
	let startFrame = $state(0);
	let endFrame = $state(getUsedTimelineDuration());

	const labelId = useId();

	const exportFile = async () => {
		encodingStarted = true;
		shrinkBox();
		appState.lockPalette = true;
		appState.encoderProgress.message = 'preparing audio...';
		appState.encoderProgress.percentage = 0;
		const fileName = inputValue ? inputValue : 'video';
		encode(fileName, startFrame, endFrame);
	};
</script>

<!-- <button onclick={() => (page = 'search')}>Back</button> -->
<div class="mx-8 flex-none py-5">
	<h1 class="text-xl text-zinc-50">export</h1>
</div>

<div class="mx-8 flex-1 content-center flex-wrap">
	{#if !encodingStarted}
		<div class="flex w-full flex-col gap-2">
			<div class="flex items-center justify-between text-sm font-medium text-white">
				<span class="text-zinc-400">file name</span>
			</div>
			<!-- svelte-ignore a11y_autofocus -->
			<Input bind:value={inputValue} />
		</div>
		<div class="flex gap-6">
			<div class="flex w-full flex-col gap-2 mt-6">
				<div class="flex items-center justify-between text-sm font-medium text-white">
					<span class="text-zinc-400">start</span>
				</div>
				<!-- svelte-ignore a11y_autofocus -->
				<Input value={startFrame} />
			</div>
			<div class="flex w-full flex-col gap-2 mt-6">
				<div class="flex items-center justify-between text-sm font-medium text-white">
					<span class="text-zinc-400">end</span>
				</div>
				<!-- svelte-ignore a11y_autofocus -->
				<Input value={endFrame} />
			</div>
		</div>
	{:else}
		<div class="flex w-full flex-col gap-4">
			<div class="flex items-center justify-between text-sm font-medium text-white">
				<span id={labelId}>{appState.encoderProgress.message}</span>
				<span>{appState.encoderProgress.percentage}%</span>
			</div>
			<Progress.Root
				aria-labelledby={labelId}
				value={appState.encoderProgress.percentage}
				max={100}
				class="bg-zinc-800 shadow-mini-inset relative h-[10px] w-full overflow-hidden rounded-full"
			>
				<div
					class="bg-white shadow-mini-inset h-full w-full flex-1 rounded-full"
					style={`transform: translateX(-${100 - (100 * (appState.encoderProgress.percentage ?? 0)) / 100}%)`}
				></div>
			</Progress.Root>
		</div>
	{/if}
</div>

<div class="mx-8 flex-none pt-5 pb-7 text-right">
	{#if !encodingStarted}
		<Button onclick={() => exportFile()} text={'Export'} />
	{:else}
		<Button
			onclick={() => (appState.showPalette = false)}
			text={'close'}
			disabled={!(appState.encoderProgress.fail || appState.encoderProgress.percentage === 100)}
		/>
	{/if}
</div>

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				if (appState.disableKeyboardShortcuts || encodingStarted) break;
				appState.palettePage = 'search';
				break;
			case 'Enter':
				if (encodingStarted) break;
				exportFile();
				break;
		}
	}}
/>
