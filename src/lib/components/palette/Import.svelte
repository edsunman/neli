<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { checkDroppedSource, createVideoSource, getSourceFromId } from '$lib/source/actions';
	import { onMount } from 'svelte';
	import type { Source } from '$lib/source/source.svelte';
	import InfoIcon from '../icons/InfoIcon.svelte';
	import SpinningIcon from '../icons/SpinningIcon.svelte';
	import Button from '../ui/Button.svelte';

	let dragHover = $state(false);
	let showDetails = $state(false);
	let thumbnail = $state('');
	let loadingMessage = $state('loading file');
	let warningMessage = $state('');
	let disableButton = $state(true);
	let fileDetails = $state({
		name: '',
		type: '',
		videoCodec: '',
		resolution: { width: 0, height: 0 },
		frameRate: 0,
		duration: 0
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
		appState.lockPalette = true;

		const files = e.dataTransfer?.files;
		if (!files) return;
		const file = files[0];

		fileDetails.name = file.name;
		fileDetails.type = file.type;

		showDetails = true;

		if (file.size > 1e9) {
			warningMessage = 'file exceeds 1GB size limit';
			loadingMessage = '';
			disableButton = false;
			return;
		}

		const info = await checkDroppedSource(file);
		const trackInfo = info?.videoTracks[0];
		if (trackInfo) {
			fileDetails.videoCodec = trackInfo.codec;
			fileDetails.resolution.height = trackInfo.track_height;
			fileDetails.resolution.width = trackInfo.track_width;
			fileDetails.duration = trackInfo.samples_duration / trackInfo.timescale;
			const frameRate = trackInfo.nb_samples / fileDetails.duration;
			fileDetails.frameRate = Math.round(frameRate * 100) / 100;

			if (fileDetails.duration > 120) {
				warningMessage = 'File duration is currently limited to 2 minutes';
			}

			loadingMessage = 'processing video';

			await createVideoSource(file, setThumbnailReady);

			setAudioReady();
		}
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
		<div class="grid grid-cols-2 grid-rows-2 mt-6 gap-2 px-2 py-4 text-white bg-hover rounded-lg">
			<div class="text-center">
				<span class="text-sm text-zinc-400">frame rate:</span>
				<span class="text-sm text-zinc-200">
					{#if fileDetails.frameRate}
						{fileDetails.frameRate}fps
					{/if}
				</span>
			</div>
			<div class="text-center">
				<span class="text-sm text-zinc-400">duration:</span>
				<span class="text-sm text-zinc-200">
					{#if fileDetails.duration}
						{formatDuration(fileDetails.duration)}
					{/if}
				</span>
			</div>
			<div class="text-center">
				<span class="text-sm text-zinc-400">resolution:</span>
				<span class="text-sm text-zinc-200">
					{#if fileDetails.resolution.height}
						{fileDetails.resolution.height} x {fileDetails.resolution.width}
					{/if}
				</span>
			</div>
			<div class="text-center">
				<span class="text-sm text-zinc-400">codec: </span>
				<span class="text-sm text-zinc-200">
					{#if fileDetails.videoCodec}
						{fileDetails.videoCodec}
					{/if}
				</span>
			</div>
		</div>
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
