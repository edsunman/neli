<script lang="ts">
	import { Progress, useId } from 'bits-ui';
	import { appState } from '$lib/state.svelte';
	import { Encoder } from '@diffusionstudio/core';

	let { page = $bindable() } = $props();
	let encoding = $state(false);

	let totalFrames = $state(10);
	let currentFrame = $state(0);
	let value = $derived(Math.ceil((currentFrame / totalFrames) * 100));
	const labelId = useId();
	console.log(labelId);

	$inspect(value);

	const exportFile = async () => {
		if (!appState.composition) return;
		encoding = true;
		const encoder = new Encoder(appState.composition);
		console.log('starting');
		encoder.on('*', (e) => {
			//console.log(e);
			totalFrames = e.detail.total;
			currentFrame = e.detail.progress;
		});
		await encoder.render('myVideo.mp4');
		console.log('done');
	};
</script>

<!-- <button onclick={() => (page = 'search')}>Back</button> -->

<h1 class="text-2xl text-zinc-200 font-semibold my-5 mx-3">Export</h1>
<div class="flex flex-col mx-3">
	{#if !encoding}
		<button
			class="bg-rose-500 hover:bg-rose-600 focus:outline-rose-500 text-white rounded-lg px-3 py-2 cursor-pointer"
			onclick={() => exportFile()}>Export</button
		>
	{:else}
		<div class="flex w-full flex-col gap-2">
			<div class="flex items-center justify-between text-sm font-medium text-white">
				<span id={labelId}>Encoding file... </span>
				<span>{value}%</span>
			</div>
			<Progress.Root
				aria-labelledby={labelId}
				{value}
				max={100}
				class="bg-zinc-800 shadow-mini-inset relative h-[15px] w-full overflow-hidden rounded-full"
			>
				<div
					class="bg-white shadow-mini-inset h-full w-full flex-1 rounded-full"
					style={`transform: translateX(-${100 - (100 * (value ?? 0)) / 100}%)`}
				></div>
			</Progress.Root>
		</div>
	{/if}
</div>

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				page = 'search';
				break;
		}
	}}
/>
