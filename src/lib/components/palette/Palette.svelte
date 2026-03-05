<script lang="ts">
	import { appState } from '$lib/state.svelte';

	import Search from './Search.svelte';
	import Export from './Export.svelte';
	import Import from './Import.svelte';
	import About from './About.svelte';
	import Projects from './Projects.svelte';
	import { closePalette } from '$lib/app/actions';
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="h-dvh w-dvw absolute top-0 left-0 flex items-center justify-center bg-black/70 backdrop-grayscale z-10"
	onmousedown={closePalette}
>
	<div
		class={[
			appState.palette.shrink ? appState.palette.shrink : 'h-[30rem]',
			'bg-zinc-925 w-lg rounded-2xl flex flex-col transition-all duration-300 ease-in-out'
		]}
		onmousedown={(e) => {
			e.stopPropagation();
		}}
	>
		{#if appState.palette.page === 'search'}
			<Search />
		{:else if appState.palette.page === 'export'}
			<Export />
		{:else if appState.palette.page === 'import'}
			<Import />
		{:else if appState.palette.page === 'projects'}
			<Projects />
		{:else if appState.palette.page === 'about'}
			<About />
		{/if}
	</div>
</div>
<svelte:window
	onkeydown={(event) => {
		// TODO: tab focus trap when palette open
		switch (event.code) {
			case 'Escape':
				closePalette();
				break;
		}
	}}
/>
