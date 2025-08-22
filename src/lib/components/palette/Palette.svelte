<script lang="ts">
	import { appState } from '$lib/state.svelte';

	let smallBox = $state(false);
	const shrinkBox = () => {
		smallBox = true;
	};

	import Search from './Search.svelte';
	import Export from './Export.svelte';
	import Import from './Import.svelte';
	import About from './About.svelte';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="h-dvh w-dvw absolute top-0 left-0 flex items-center justify-center bg-black/50 backdrop-grayscale"
	onmousedown={() => {
		if (appState.lockPalette) return;
		appState.showPalette = false;
		appState.palettePage = 'search';
		appState.disableKeyboardShortcuts = false;
	}}
>
	<div
		class={[
			smallBox ? 'h-60' : 'h-[30rem]',
			'bg-zinc-900 w-lg rounded-lg flex flex-col transition-all duration-500 ease-in-out -z-10'
		]}
		onmousedown={(e) => {
			e.stopPropagation();
		}}
	>
		{#if appState.palettePage === 'search'}
			<Search />
		{:else if appState.palettePage === 'export'}
			<Export {shrinkBox} />
		{:else if appState.palettePage === 'import'}
			<Import />
		{:else if appState.palettePage === 'about'}
			<About />
		{/if}
	</div>
</div>
<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'Escape':
				if (appState.lockPalette) return;
				appState.showPalette = false;
				appState.palettePage = 'search';
				appState.disableKeyboardShortcuts = false;
				break;
		}
	}}
/>
