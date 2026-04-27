<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { onMount } from 'svelte';
	import ProgressBar from './ProgressBar.svelte';
	import { formatStorageSize } from '$lib/app/utils';

	let percentUsed = $state(0);
	let message = $state('');

	const getStorageInfo = async () => {
		if (navigator.storage && navigator.storage.estimate) {
			const { usage, quota } = await navigator.storage.estimate();
			if (!usage || !quota) return;
			percentUsed = (usage! / quota!) * 100;
			message = `Used: ${formatStorageSize(usage)} of ${formatStorageSize(quota)}`;
		}
	};

	onMount(async () => {
		getStorageInfo();
	});
</script>

<div class="px-8 h-full gap-1 flex flex-col">
	<h3 class="text-zinc-400 mt-10 mb-4">Local storage</h3>
	<ProgressBar percentage={percentUsed} {message} />
	<div class="text-zinc-400 mt-8 text-sm">
		<p>Some files are cached to disk to improve peformance.</p>
	</div>
</div>

<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Backspace':
				if (appState.disableKeyboardShortcuts || appState.progress.started) break;
				appState.palette.page = 'search';
				break;
		}
	}}
/>
