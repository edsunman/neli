<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { clickToImportFile, dropToImportFile } from '$lib/source/actions';
	import { infoIcon, audioIcon, helpIcon } from '../icons/Icons.svelte';
	import { closePalette } from '$lib/app/actions';

	import Button from '../ui/Button.svelte';

	let dragHover = $state(false);

	const formatDuration = (seconds: number) => {
		seconds = Math.floor(seconds);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		const formattedMinutes = String(minutes).padStart(2, '0');
		const formattedSeconds = String(remainingSeconds).padStart(2, '0');
		return `${formattedMinutes}:${formattedSeconds}`;
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
</script>

<div class="flex-1 px-8 bg-zinc-900 rounded-2xl grow flex flex-col">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#if !appState.import.importStarted}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class={[
				dragHover ? 'border-zinc-400 text-zinc-200' : 'border-zinc-600 text-zinc-400',
				'hover:border-zinc-400 rounded-xl border-2 hover:text-zinc-200 flex-1',
				'grow mt-8 mx-12 mb-12 border-dashed items-center justify-center flex'
			]}
			ondrop={(e) => {
				e.preventDefault();
				dropToImportFile(e);
			}}
			ondragover={(e) => e.preventDefault()}
			ondragenter={() => (dragHover = true)}
			ondragleave={() => (dragHover = false)}
			onclick={() => clickToImportFile()}
		>
			<p class="text-center">
				drop files to import<br /><small>(.mp4, .mp3, .wav, .srt, .jpg, .png)</small>
			</p>
		</div>
	{:else if appState.import.fileDetails}
		{@const fileDetails = appState.import.fileDetails}
		<div class="flex-1">
			<div class="text-zinc-200 flex mt-8">
				<div class="w-30 h-20 mx-10 relative">
					{#if appState.import.thumbnail}
						<div
							style:background-image={`url(${appState.import.thumbnail})`}
							class={[
								'absolute rounded-lg w-full h-full bg-cover bg-center opacity-100',
								'starting:opacity-0 transition-opacity duration-500'
							]}
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
						{@render info(
							'frame rate:',
							`${Math.round(fileDetails.info.frameRate * 100) / 100}fps`
						)}
					{/if}
					{#if fileDetails.info.type === 'image'}
						{@render info('format:', fileDetails.info.mimeType === 'image/png' ? 'png' : 'jpg')}
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
			{#if appState.import.warningMessage}
				<div
					class="text-rose-500 text-sm border border-rose-700 rounded-lg p-2 mt-4 flex items-center"
				>
					{@render infoIcon('size-6 mr-2 text-rose-600')}
					<p class="flex-1 content-center">{appState.import.warningMessage}</p>
				</div>
			{/if}
		</div>
		<div class="flex-none pt-5 pb-7 text-right">
			<Button
				onclick={() => {
					closePalette();
				}}
				text="done"
				disabled={appState.palette.lock}
			/>
		</div>
	{/if}
</div>

{#snippet info(text: string, info: string | number)}
	<div class="text-center">
		<span class="text-sm text-zinc-400">{text}</span>
		<span class="text-sm text-zinc-200">
			{info}
		</span>
	</div>
{/snippet}
