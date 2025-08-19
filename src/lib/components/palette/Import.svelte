<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { checkDroppedSource, createAudioSource, createVideoSource } from '$lib/source/actions';
	import type { Source } from '$lib/source/source.svelte';
	import InfoIcon from '../icons/InfoIcon.svelte';
	import SpinningIcon from '../icons/SpinningIcon.svelte';
	import Button from '../ui/Button.svelte';
	import type { FileInfo } from '$lib/types';

	let dragHover = $state(false);
	let showDetails = $state(false);
	let thumbnail = $state('');
	let loadingMessage = $state('loading file');
	let warningMessage = $state('');
	let disableButton = $state(true);
	let fileDetails = $state<{ name: string; type: string; info: FileInfo | null }>({
		name: '',
		type: '',
		info: null
	});
	let thumbnailReady = false;
	let audioReady = false;

	const formatDuration = (seconds: number) => {
		seconds = Math.floor(seconds);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		const formattedMinutes = String(minutes).padStart(2, '0');
		const formattedSeconds = String(remainingSeconds).padStart(2, '0');
		return `${formattedMinutes}:${formattedSeconds}`;
	};

	const setThumbnailReady = (source: Source, gap: number) => {
		thumbnailReady = true;
		thumbnail = source.thumbnail;
		if (gap > 70 && warningMessage === '') {
			warningMessage =
				'this video has a large gap between keyframes which may result in poor playback performance';
		}
		if (audioReady) {
			unlock();
		} else {
			loadingMessage = 'generating audio waveform';
		}
	};

	const setAudioReady = () => {
		audioReady = true;
		if (thumbnailReady) unlock();
	};

	const unlock = () => {
		loadingMessage = '';
		appState.lockPalette = false;
		disableButton = false;
	};

	const onDrop = async (e: DragEvent) => {
		e.preventDefault();
		dragHover = false;

		const files = e.dataTransfer?.files;
		if (!files) return;
		const file = files[0];

		console.log(file.type);

		if (file.type !== 'video/mp4' && file.type !== 'audio/mpeg' && file.type !== 'audio/wav')
			return;

		fileDetails.name = file.name;
		fileDetails.type = file.type;

		appState.lockPalette = true;
		showDetails = true;

		if (file.size > 1e9) {
			warningMessage = 'file exceeds 1GB size limit';
			loadingMessage = '';
			disableButton = false;
			return;
		}

		const info = await checkDroppedSource(file);
		if (!info) return;

		if ('error' in info) {
			warningMessage = info.error ?? '';
			loadingMessage = '';
			disableButton = false;
			return;
		}

		fileDetails.info = info;

		if (info.duration > 120) {
			warningMessage = 'File duration is currently limited to 2 minutes';
		}

		if (info.type === 'video') {
			loadingMessage = 'processing video';
			await createVideoSource(file, setThumbnailReady, info.duration, info.frameRate);
		}

		if (info.type === 'audio') {
			loadingMessage = 'generating audio waveform';
			thumbnailReady = true;
			await createAudioSource(file, info.duration);
		}

		setAudioReady();
	};
</script>

<div class="mx-8 flex-none py-5">
	<h1 class="text-xl text-zinc-50">import</h1>
</div>

<div class="mx-8 flex-1 grow flex flex-col">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#if !showDetails}
		<div
			class={[
				dragHover ? 'border-zinc-300 text-zinc-200' : 'border-zinc-600 text-zinc-400',
				'rounded-xl border-2  flex-1 grow mt-8 mx-12 mb-12 border-dashed items-center justify-center flex'
			]}
			ondrop={onDrop}
			ondragover={(e) => e.preventDefault()}
			ondragenter={() => (dragHover = true)}
			ondragleave={() => (dragHover = false)}
		>
			drop files to import
		</div>
	{:else}
		<div class="text-zinc-200 flex mt-2">
			<div class="w-30 h-20 mx-10 relative">
				{#if thumbnail}
					<div
						style:background-image={`url(${thumbnail})`}
						class="absolute rounded-lg w-full h-full bg-cover bg-center opacity-100 starting:opacity-0 transition-opacity duration-500"
					></div>
				{/if}
				<div class="border-2 border-zinc-700 rounded-lg w-full h-full"></div>
			</div>
			<div class="w-20 flex-1 content-center"><p>{fileDetails.name}</p></div>
		</div>
		{#if fileDetails.info && !('error' in fileDetails.info)}
			<div class="grid grid-cols-2 grid-rows-2 mt-6 gap-2 px-2 py-4 text-white bg-hover rounded-lg">
				{#if fileDetails.info.type === 'video'}
					{@render info('codec:', fileDetails.info.codec)}
					{@render info('duration:', formatDuration(fileDetails.info.duration))}
					{@render info(
						'resolution:',
						`${fileDetails.info.resolution.height} x ${fileDetails.info.resolution.width}`
					)}
					{@render info('frame rate:', `${Math.round(fileDetails.info.frameRate * 100) / 100}fps`)}
				{/if}
				{#if fileDetails.info.type === 'audio'}
					{@render info('codec:', fileDetails.info.codec)}
					{@render info('duration:', formatDuration(fileDetails.info.duration))}
					{@render info('sample rate:', `${fileDetails.info.sampleRate / 1000} kHz`)}
					{@render info('channels:', fileDetails.info.channelCount)}
				{/if}
			</div>
		{/if}
		{#if warningMessage}
			<div
				class="text-rose-500 text-sm border border-rose-700 rounded-lg p-2 mt-4 flex items-center"
			>
				<InfoIcon class="size-6 mr-2 text-rose-600" />
				<p class="flex-1 content-center">{warningMessage}</p>
			</div>
		{/if}
		{#if loadingMessage}
			<div class="text-zinc-200 mt-4 flex justify-center">
				<div class="mr-4 content-center"><SpinningIcon class="size-5" /></div>
				<p class="content-center">{loadingMessage}</p>
			</div>
		{/if}
	{/if}
</div>
{#if showDetails}
	<div class="mx-8 flex-none pt-5 pb-7 text-right">
		<Button
			onclick={() => {
				appState.showPalette = false;
				appState.palettePage = 'search';
			}}
			text={'Close'}
			disabled={disableButton}
		/>
	</div>
{/if}

{#snippet info(text: string, info: string | number)}
	<div class="text-center">
		<span class="text-sm text-zinc-400">{text}</span>
		<span class="text-sm text-zinc-200">
			{info}
		</span>
	</div>
{/snippet}

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
