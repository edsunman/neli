<script lang="ts">
	import { appState } from '$lib/state.svelte';

	import Export from './Export.svelte';
	import Search from './Search.svelte';

	let page = $state<'search' | 'export' | 'import'>('search');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="h-dvh w-dvw absolute top-0 left-0 flex items-center justify-center bg-black/50"
	onclick={() => {
		appState.showPalette = false;
	}}
>
	<div
		class="bg-zinc-900 w-lg h-[30rem] rounded-lg px-8"
		onclick={(e) => {
			e.stopPropagation();
		}}
	>
		{#if page === 'search'}
			<Search bind:page />
		{:else if page === 'export'}
			<Export bind:page />
		{/if}
	</div>
</div>
