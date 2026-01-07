<script lang="ts">
	import { Progress, useId } from 'bits-ui';
	import { appState } from '$lib/state.svelte';
	import { encode } from '$lib/worker/actions.svelte';
	import Button from '../ui/Button.svelte';
	import Input from '../ui/Input.svelte';
	import { getUsedTimelineDuration } from '$lib/timeline/actions';
	import { tick } from 'svelte';
	import { framesToTimecode, stringToFramesAndSynopsis } from '$lib/timeline/utils';
	import { backArrowIcon } from '../icons/Icons.svelte';

	let { shrinkBox } = $props();

	let inputValue = $state('');
	let encodingStarted = $state(false);
	let startFrame = $state(0);
	let endFrame = $state(getUsedTimelineDuration());
	let closeButton = $state<HTMLButtonElement>();

	const labelId = useId();

	const exportFile = async () => {
		if (startFrame >= endFrame) return;
		encodingStarted = true;
		shrinkBox();
		appState.lockPalette = true;
		appState.encoderProgress.message = 'preparing audio...';
		appState.encoderProgress.percentage = 0;
		appState.exportSuccessCallback = exportSuccess;
		const fileName = inputValue ? inputValue : 'video';
		encode(fileName, startFrame, endFrame);
	};

	const exportSuccess = async () => {
		await tick();
		if (closeButton) {
			closeButton.focus();
		}
	};
</script>

<!-- <button onclick={() => (page = 'search')}>Back</button> -->
<div class="mx-8 flex-none flex py-5 items-center text-zinc-50">
	<button
		onclick={() => {
			if (encodingStarted) return;
			appState.palettePage = 'search';
		}}
		class={[
			encodingStarted ? 'opacity-0' : 'opacity-100',
			'mr-2 pt-[2px] starting:opacity-0 transition-opacity delay-100 text-zinc-500 hover:text-zinc-50'
		]}
	>
		{@render backArrowIcon('size-4')}
	</button>

	<h1 class="text-xl starting:transform-[translateX(-24px)] transition-transform">export</h1>
</div>

<div class="px-8 flex-1 flex flex-col bg-zinc-900 rounded-2xl content-center flex-wrap">
	<div class="flex-1 content-center flex-wrap w-full">
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
					<Input
						value={framesToTimecode(0)}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							const { frames } = stringToFramesAndSynopsis(target.value);
							startFrame = frames;
						}}
						onblur={(e) => {
							const target = e.target as HTMLInputElement;
							if (!target.value) target.value = framesToTimecode(0);
						}}
					/>
				</div>
				<div class="flex w-full flex-col gap-2 mt-6">
					<div class="flex items-center justify-between text-sm font-medium text-white">
						<span class="text-zinc-400">end</span>
					</div>
					<!-- svelte-ignore a11y_autofocus -->
					<Input
						value={framesToTimecode(getUsedTimelineDuration())}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							const { frames } = stringToFramesAndSynopsis(target.value);
							endFrame = frames;
						}}
						onblur={(e) => {
							const target = e.target as HTMLInputElement;
							if (!target.value) target.value = framesToTimecode(getUsedTimelineDuration());
						}}
					/>
				</div>
			</div>
		{:else}
			<div class="flex w-full flex-col gap-4 my-8">
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
	<div class="flex-none pt-5 pb-7 text-right">
		{#if !encodingStarted}
			<Button disabled={startFrame >= endFrame} onclick={() => exportFile()} text={'Export'} />
		{:else}
			<Button
				bind:ref={closeButton}
				onclick={() => (appState.showPalette = false)}
				text={'close'}
				disabled={!(appState.encoderProgress.fail || appState.encoderProgress.percentage === 100)}
			/>
		{/if}
	</div>
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
