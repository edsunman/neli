<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { checkDroppedSource } from '$lib/source/actions';

	let { page = $bindable() } = $props();

	let showDetails = $state(false);
	let fileDetails = $state({
		name: '',
		type: '',
		videoCodec: '',
		resolution: { width: 0, height: 0 },
		frameRate: 0,
		duration: 0
	});

	const formatDuration = (seconds: number) => {
		// Ensure seconds is a non-negative integer
		seconds = Math.floor(seconds);

		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		// Use padStart to add a leading zero if the number is less than 10
		const formattedMinutes = String(minutes).padStart(2, '0');
		const formattedSeconds = String(remainingSeconds).padStart(2, '0');

		return `${formattedMinutes}:${formattedSeconds}`;
	};

	const onDrop = async (e: DragEvent) => {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		const file = files[0];

		fileDetails.name = file.name;
		fileDetails.type = file.type;

		const info = await checkDroppedSource(file);
		if (info) console.log(info);
		const trackInfo = info?.videoTracks[0];
		if (trackInfo) {
			fileDetails.videoCodec = trackInfo.codec;
			fileDetails.resolution.height = trackInfo.track_height;
			fileDetails.resolution.width = trackInfo.track_width;
			fileDetails.frameRate = trackInfo.nb_samples / (trackInfo.duration / trackInfo.timescale);
			fileDetails.duration = trackInfo.movie_duration / trackInfo.movie_timescale;
		}

		showDetails = true;
	};
</script>

<div class="mx-8 flex-none py-5">
	<h1 class="text-xl text-zinc-50">import</h1>
</div>

<div class="mx-8 flex-1 grow flex flex-col">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#if !showDetails}
		<div
			class="rounded-xl border-2 border-zinc-700 text-zinc-400 flex-1 grow mt-8 mx-12 mb-12 border-dashed items-center justify-center flex"
			ondrop={onDrop}
			ondragover={(e) => e.preventDefault()}
		>
			drop files to import
		</div>
	{:else}
		<div class=" text-white">
			name: {fileDetails.name} <br />
			type: {fileDetails.type} <br />
			codec: {fileDetails.videoCodec} <br />
			framerate: {fileDetails.frameRate}fps <br />
			duration: {formatDuration(fileDetails.duration)}
		</div>
	{/if}
</div>

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				if (appState.disableKeyboardShortcuts) break;
				page = 'search';
				break;
		}
	}}
/>
