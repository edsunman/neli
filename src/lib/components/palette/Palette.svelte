<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { closePalette } from '$lib/app/actions';
	import { onMount } from 'svelte';
	import { backArrowIcon } from '../icons/Icons.svelte';

	import Search from './Search.svelte';
	import Export from './Export.svelte';
	import Import from './Import.svelte';
	import About from './About.svelte';
	import Projects from './Projects.svelte';
	import DeleteProject from './DeleteProject.svelte';
	import Settings from './Settings.svelte';

	let searchComponent = $state<Search>();
	let searchInput = $state<HTMLInputElement>();
	let showBackButton = $state(false);

	onMount(() => {
		setPageTitle();
		if (appState.palette.page === 'search') searchInput?.focus();
	});

	const onSelect = () => {
		setPageTitle();
	};

	const setPageTitle = () => {
		if (!searchInput) return;
		if (appState.palette.page === 'import') {
			searchInput.value = 'import';
			showBackButton = true;
		}
		if (appState.palette.page === 'export') {
			searchInput.value = 'export';
			showBackButton = true;
		}
		if (appState.palette.page === 'projects') {
			searchInput.value = 'load project';
			showBackButton = true;
		}
		if (appState.palette.page === 'settings') {
			searchInput.value = 'settings';
			showBackButton = true;
		}
		if (appState.palette.page === 'search') {
			searchInput.value = '';
			searchInput.focus();
		}
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="h-dvh w-dvw absolute top-0 left-0 grid bg-black/70 backdrop-grayscale z-10 items-center justify-center"
	onmousedown={closePalette}
	onmousemove={(e)=>e.stopPropagation()}
>
	<div
		class={[
			appState.palette.shrink || appState.palette.page === 'about'
				? '-translate-y-[0px]'
				: '-translate-y-[225px]',
			'bg-zinc-925 z-2 px-8 h-20 row-start-1 col-start-1 rounded-t-2xl transition-transform duration-400 ease-in-out'
		]}
		onmousedown={(e) => {
			e.stopPropagation();
		}}
	>
		<div class="flex h-16 items-center">
			<button
				onclick={() => {
					appState.palette.page = 'search';
					if (searchInput) {
						searchInput.value = '';
						searchInput.focus();
					}
					showBackButton = false;
				}}
				class={[
					showBackButton ? 'opacity-100 transition-opacity delay-100 ' : 'opacity-0',
					'mr-2 pt-[2px] hover:text-zinc-50  text-zinc-500 '
				]}
			>
				{@render backArrowIcon('size-4')}
			</button>
			<form
				class="flex-1"
				onsubmit={(e) => {
					e.preventDefault();
					if (!searchComponent) return;
					const chosenSelected = searchComponent.chooseSelected();
					if (chosenSelected) {
						setPageTitle();
						searchInput?.blur();
					}
				}}
			>
				<input
					bind:this={searchInput}
					oninput={(e) => {
						showBackButton = false;
						appState.palette.page = 'search';
						if (searchComponent) searchComponent.onInputChange(e.currentTarget.value);
					}}
					class={[
						showBackButton
							? 'transform-[translateX(0px)] transition-transform'
							: 'transform-[translateX(-24px)]',
						'placeholder-zinc-500 w-full placeholder:text-lg text-zinc-50 focus:outline-hidden text-xl  '
					]}
					type="text"
					placeholder="Search (or type number to seek)"
				/>
			</form>
		</div>
	</div>
	<div
		class={[
			appState.palette.page === 'about'
				? 'height-md:h-[30rem] h-[20rem]'
				: appState.palette.shrink
					? appState.palette.shrink
					: 'h-[25rem]',
			'bg-zinc-900 min-[520px]:w-lg row-start-1 col-start-1 z-2 rounded-2xl flex flex-col transition-all duration-400 ease-in-out overflow-y-hidden'
		]}
		onmousedown={(e) => {
			e.stopPropagation();
		}}
	>
		{#if appState.palette.page === 'search'}
			<Search bind:this={searchComponent} {onSelect} />
		{:else if appState.palette.page === 'export'}
			<Export />
		{:else if appState.palette.page === 'import'}
			<Import />
		{:else if appState.palette.page === 'projects'}
			<Projects />
		{:else if appState.palette.page === 'about'}
			<About {onSelect} />
		{:else if appState.palette.page === 'delete'}
			<DeleteProject />
		{:else if appState.palette.page === 'settings'}
			<Settings />
		{/if}
	</div>
	<div
		class={[
			appState.palette.page === 'about' ? 'height-md:translate-y-[205px] translate-y-[125px]' : 'translate-y-[0px]',
			'bg-linear-to-r from-rose-500 to-pink-600',
			'z-1 px-8 h-20 row-start-1 col-start-1 rounded-b-2xl transition-transform duration-400 ease-in-out'
		]}
	></div>
</div>
<svelte:window
	onkeydown={(event) => {
		// TODO: tab focus trap when palette open
		switch (event.code) {
			case 'Escape':
				closePalette();
				break;
			case 'Backspace':
				if (
					appState.disableKeyboardShortcuts ||
					appState.palette.page === 'search' ||
					appState.palette.page === 'delete'
				)
					break;
				appState.import.importStarted = false;
				appState.palette.page = 'search';
				showBackButton = false;
				if (searchInput) {
					searchInput.value = '';
					searchInput.focus();
				}
				break;
		}
	}}
/>
