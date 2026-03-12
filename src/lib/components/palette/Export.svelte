<script lang="ts">
	import { Progress, useId } from 'bits-ui';
	import { appState, workerManager } from '$lib/state.svelte';
	import Button from '../ui/Button.svelte';
	import Input from '../ui/Input.svelte';
	import { getUsedTimelineDuration } from '$lib/timeline/actions';
	import { tick } from 'svelte';
	import { framesToTimecode, stringToFramesAndSynopsis } from '$lib/timeline/utils';
	import TitleBar from './TitleBar.svelte';
	import { renderAudioForExport } from '$lib/audio/actions';
	import ProgressBar from './ProgressBar.svelte';
	import { closePalette } from '$lib/app/actions';

	let inputValue = $state('');
	let encodingFinished = $state(false);
	let startFrame = $state(0);
	let endFrame = $state(getUsedTimelineDuration());
	let closeButton = $state<HTMLButtonElement>();

	const exportFile = async () => {
		if (startFrame >= endFrame) return;

		appState.palette.shrink = 'h-70';
		appState.palette.lock = true;
		appState.progress.started = true;
		appState.progress.message = 'preparing audio...';
		appState.progress.percentage = 0;
		appState.exportSuccessCallback = exportCallback;

		const audioBuffer = await renderAudioForExport(startFrame, endFrame);
		appState.progress.message = 'encoding video...';

		const fileName = inputValue ? inputValue : 'video';
		workerManager.encode(fileName, startFrame, endFrame, audioBuffer);
	};

	const exportCallback = async (success: boolean) => {
		encodingFinished = true;
		appState.palette.lock = false;
		await tick();
		if (closeButton) {
			closeButton.focus();
		}
	};

	const cancel = () => {
		appState.progress.message = 'cancelling...';
		workerManager.cancelEncode();
		appState.palette.lock = false;
		closePalette();
	};
</script>

<!-- <button onclick={() => (page = 'search')}>Back</button> -->
<TitleBar
	title="export"
	onclick={() => {
		appState.palette.page = 'search';
	}}
	disabled={appState.progress.started}
/>

<div class="px-8 flex-1 flex flex-col bg-zinc-900 rounded-2xl content-center flex-wrap">
	<div class="flex-1 content-center flex-wrap w-full">
		{#if appState.progress.started}
			<ProgressBar />
		{:else}
			<div class="flex w-full flex-col gap-2">
				<div class="flex items-center justify-between text-sm font-medium text-white">
					<span class="text-zinc-400">file name</span>
				</div>
				<Input bind:value={inputValue} />
			</div>
			<div class="flex gap-6">
				<div class="flex w-full flex-col gap-2 mt-6">
					<div class="flex items-center justify-between text-sm font-medium text-white">
						<span class="text-zinc-400">start</span>
					</div>
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
		{/if}
	</div>

	<div class="flex-none pt-5 pb-7 text-right">
		{#if !appState.progress.started}
			<Button disabled={startFrame >= endFrame} onclick={() => exportFile()} text="Export" />
		{:else if appState.progress.started && !encodingFinished}
			<Button onclick={() => cancel()} text="cancel" />
		{:else}
			<Button
				bind:ref={closeButton}
				onclick={() => {
					closePalette();
					appState.disableKeyboardShortcuts = false;
				}}
				text="close"
			/>
		{/if}
	</div>
</div>

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				if (appState.disableKeyboardShortcuts || appState.progress.started) break;
				appState.palette.page = 'search';
				break;
			case 'Enter':
				if (appState.progress.started) break;
				exportFile();
				break;
		}
	}}
/>
