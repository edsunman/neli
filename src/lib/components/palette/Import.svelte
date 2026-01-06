<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import {
		checkDroppedSource,
		createAudioSource,
		createSrtSource,
		createVideoSource,
		createImageSource
	} from '$lib/source/actions';
	import { onMount } from 'svelte';
	import type { Source } from '$lib/source/source.svelte';
	import type { FileInfo } from '$lib/types';
	import { infoIcon, spinningIcon, audioIcon, helpIcon } from '../icons/Icons.svelte';

	import Button from '../ui/Button.svelte';

	let fileInput = $state<HTMLInputElement>();
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
	let thumbnailReady = true;
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
			warningMessage = `this video has a large gap between keyframes (${gap}) which may result in poor playback performance`;
		}
		if (audioReady) {
			unlock();
		} else {
			loadingMessage = 'generating audio waveform';
		}
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

		processFile(file);
	};

	const processFile = async (file: File) => {
		//console.log(file.type);
		appState.lockPalette = true;
		showDetails = true;
		appState.fileToImport = null;

		fileDetails.name = file.name;
		fileDetails.type = file.type;
		console.log(fileDetails.type);
		if (!file.type) {
			const lastDotIndex = file.name.lastIndexOf('.');
			const extension = file.name.slice(lastDotIndex);
			if (extension === '.srt') fileDetails.type = 'application/x-subrip';
		}

		if (
			fileDetails.type !== 'video/mp4' &&
			fileDetails.type !== 'audio/mpeg' &&
			fileDetails.type !== 'audio/wav' &&
			fileDetails.type !== 'application/x-subrip' &&
			fileDetails.type !== 'image/jpeg' &&
			fileDetails.type !== 'image/png'
		) {
			fileDetails.type = 'unknown';
			warningMessage = 'file type not supported';
			loadingMessage = '';
			disableButton = false;
			return;
		}

		if (file.size > 1e9) {
			warningMessage = 'file exceeds 1GB size limit';
			fileDetails.type = 'unknown';
			loadingMessage = '';
			disableButton = false;
			return;
		}

		const info = await checkDroppedSource(file, fileDetails.type);
		if (!info) return;

		if ('error' in info) {
			warningMessage = info.error ?? '';
			loadingMessage = '';
			disableButton = false;
			return;
		}

		fileDetails.info = info;

		if (info.type === 'video' && info.duration > 120) {
			warningMessage = 'File duration is currently limited to 2 minutes';
		}

		if (info.type === 'video') {
			loadingMessage = 'processing video';
			thumbnailReady = false;
			await createVideoSource(
				file,
				setThumbnailReady,
				info.duration,
				info.frameRate,
				info.resolution
			);
		}

		if (info.type === 'image') {
			await createImageSource(file, setThumbnailReady, info.resolution);
		}

		if (info.type === 'audio') {
			loadingMessage = 'generating audio waveform';
			await createAudioSource(file, info.duration);
		}

		if (info.type === 'srt') {
			await createSrtSource(file);
		}

		audioReady = true;
		if (thumbnailReady) unlock();
	};

	const truncateString = (str: string, maxLength: number) => {
		if (!str || str.length <= maxLength) {
			return str;
		}
		const ellipsis = '...';
		const truncateLength = maxLength - ellipsis.length;
		if (truncateLength <= 0) {
			return maxLength >= 1 ? str.substring(0, maxLength) : ellipsis;
		}
		return str.substring(0, truncateLength) + ellipsis;
	};

	onMount(() => {
		if (appState.fileToImport) {
			processFile(appState.fileToImport);
		}
	});
</script>

<div class="mx-8 flex-none py-5">
	<h1 class="text-xl text-zinc-50">import</h1>
</div>

<div class="mx-8 flex-1 grow flex flex-col">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#if !showDetails}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class={[
				dragHover ? 'border-zinc-400' : 'border-zinc-600',
				'hover:border-zinc-400 rounded-xl border-2 text-zinc-200 flex-1',
				'grow mt-8 mx-12 mb-12 border-dashed items-center justify-center flex'
			]}
			ondrop={onDrop}
			ondragover={(e) => e.preventDefault()}
			ondragenter={() => (dragHover = true)}
			ondragleave={() => (dragHover = false)}
			onclick={() => {
				if (!fileInput) return;
				fileInput.click();
			}}
		>
			<p class="text-center">
				drop files to import<br /><small>(.mp4, .mp3, .wav, .srt, .jpg, .png)</small>
			</p>
		</div>
		<input
			onchange={(e) => {
				if (!e.currentTarget.files) return;
				const file = e.currentTarget.files[0];
				processFile(file);
			}}
			bind:this={fileInput}
			type="file"
			class="hidden"
		/>
	{:else}
		<div class="text-zinc-200 flex mt-2">
			<div class="w-30 h-20 mx-10 relative">
				{#if thumbnail}
					<div
						style:background-image={`url(${thumbnail})`}
						class="absolute rounded-lg w-full h-full bg-cover bg-center opacity-100 starting:opacity-0 transition-opacity duration-500"
					></div>
				{/if}
				<div
					class={[
						fileDetails.type === 'audio/mpeg' || fileDetails.type === 'audio/wav'
							? 'bg-clip-blue-500'
							: fileDetails.type === 'application/x-subrip'
								? 'bg-clip-purple-500'
								: 'border-2 border-zinc-700',
						'rounded-lg w-full h-full flex items-center justify-center'
					]}
				>
					{#if fileDetails.type === 'audio/mpeg' || fileDetails.type === 'audio/wav'}
						{@render audioIcon('size-12 text-clip-blue-600')}
					{/if}
					{#if fileDetails.type === 'application/x-subrip'}
						<span class="text-clip-purple-600 text-3xl font-extrabold">.srt</span>
					{/if}
					{#if fileDetails.type === 'unknown'}
						{@render helpIcon('size-12 text-zinc-600')}
					{/if}
				</div>
			</div>
			<div class="w-20 flex-1 content-center wrap-break-word">
				{truncateString(fileDetails.name, 80)}
			</div>
		</div>
		{#if fileDetails.info && !('error' in fileDetails.info)}
			<div class="grid grid-cols-2 mt-6 gap-2 px-2 py-4 text-white bg-hover rounded-lg">
				{#if fileDetails.info.type === 'video'}
					{@render info('codec:', fileDetails.info.codec)}
					{@render info('duration:', formatDuration(fileDetails.info.duration))}
					{@render info(
						'resolution:',
						`${fileDetails.info.resolution.width} x ${fileDetails.info.resolution.height}`
					)}
					{@render info('frame rate:', `${Math.round(fileDetails.info.frameRate * 100) / 100}fps`)}
				{/if}
				{#if fileDetails.info.type === 'image'}
					{@render info('format:', fileDetails.info.format)}
					{@render info(
						'resolution:',
						`${fileDetails.info.resolution.width} x ${fileDetails.info.resolution.height}`
					)}
				{/if}
				{#if fileDetails.info.type === 'audio'}
					{@render info('codec:', fileDetails.info.codec)}
					{@render info('duration:', formatDuration(fileDetails.info.duration))}
					{@render info('sample rate:', `${fileDetails.info.sampleRate / 1000} kHz`)}
					{@render info('channels:', fileDetails.info.channelCount)}
				{/if}
				{#if fileDetails.info.type === 'srt'}
					{@render info('duration:', fileDetails.info.duration)}
					{@render info('captions:', fileDetails.info.entries)}
				{/if}
			</div>
		{/if}
		{#if warningMessage}
			<div
				class="text-rose-500 text-sm border border-rose-700 rounded-lg p-2 mt-4 flex items-center"
			>
				{@render infoIcon('size-6 mr-2 text-rose-600')}
				<p class="flex-1 content-center">{warningMessage}</p>
			</div>
		{/if}
		{#if loadingMessage}
			<div class="text-zinc-200 mt-4 flex justify-center">
				<div class="mr-4 content-center">{@render spinningIcon('size-5')}</div>
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
			text={'Done'}
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
