<script lang="ts">
	import { createTextSource } from '$lib/source/actions';
	import { appState } from '$lib/state.svelte';
	import { untrack } from 'svelte';

	let { page = $bindable() } = $props();
	let inputValue = $state<string>();
	let selectedIndex = -1;

	const categories = $state.raw([
		{
			id: 1,
			name: 'App',
			commands: [
				{
					id: 1,
					text: 'Import',
					selected: false,
					action: () => console.log(1)
				},
				{
					id: 2,
					text: 'Export',
					selected: false,
					action: () => (page = 'export')
				},
				{
					id: 3,
					text: 'Settings',
					selected: false,
					action: () => console.log(2)
				},
				{
					id: 4,
					text: 'Welcome',
					selected: false,
					action: () => console.log(3)
				}
			]
		},
		{
			id: 2,
			name: 'Timeline',
			commands: [
				{
					id: 5,
					text: 'Zoom in',
					selected: false,
					action: () => console.log(1)
				},
				{
					id: 6,
					text: 'Zoom out',
					selected: false,
					action: () => (page = 'export')
				}
			]
		},
		{
			id: 3,
			name: 'Project',
			commands: [
				{
					id: 7,
					text: 'Add text',
					selected: false,
					action: () => {
						createTextSource();
						appState.showPalette = false;
					}
				},
				{
					id: 8,
					text: 'Add test card',
					selected: false,
					action: () => (page = 'export')
				}
			]
		}
	]);
	let filtered = $derived.by(() => {
		return categories.map((category) => {
			return {
				...category,
				commands: category.commands.filter((command) => {
					return command.text.toLowerCase().includes(inputValue?.toLowerCase() ?? '');
				})
			};
		});
	});

	$effect(() => {
		inputValue;
		untrack(() => {
			if (typeof inputValue === 'undefined') return;
			let filteredCount = 0;
			filtered.forEach((category) => {
				filteredCount += category.commands.length;
			});
			if (inputValue.length < 1) {
				selectDataById(-1);
			} else if (filteredCount > 0) selectDataByIndex(0);
		});
	});

	const selectDataByIndex = (index: number) => {
		let filteredCount = 0;
		filtered.forEach((category) => {
			filteredCount += category.commands.length;
		});
		if (index < 0 || filteredCount < index + 1) return;
		let i = 0;
		filtered.forEach((category) => {
			category.commands.forEach((command) => {
				if (command.selected) command.selected = false;
				if (index === i) {
					command.selected = true;
					selectedIndex = index;
				}
				i++;
			});
		});
		filtered = [...filtered];
	};

	const selectDataById = (id: number) => {
		let i = -1;
		filtered.forEach((category) => {
			category.commands.forEach((command) => {
				if (command.selected) command.selected = false;
				if (command.id === id) {
					command.selected = true;
					selectedIndex = i;
				}
				i++;
			});
		});
		filtered = [...filtered];
	};

	const formatString = (string: string) => {
		const reg = new RegExp(inputValue ?? '', 'gi');
		return string.replace(reg, function (str) {
			return '<span class="underline">' + str + '</span>';
		});
	};
</script>

<!-- svelte-ignore a11y_autofocus -->
<form
	onsubmit={() => {
		for (const category of filtered) {
			for (const command of category.commands) {
				if (command.selected && command.action) {
					command.action();
					break;
				}
			}
		}
	}}
>
	<input
		bind:value={inputValue}
		class="placeholder-zinc-500 w-full py-5 text-zinc-50 focus:outline-hidden text-xl"
		type="text"
		placeholder="Search commands"
		autofocus
	/>
</form>
{#each filtered as category}
	{#if category.commands.length > 0}
		<div class="pb-4">
			<div class="text-zinc-200 select-none text-sm">{category.name}</div>

			{#each category.commands as command}
				<div class="my-2">
					<!-- svelte-ignore a11y_mouse_events_have_key_events -->
					<button
						onmousemove={() => {
							if (!command.selected) selectDataById(command.id);
						}}
						onclick={command.action}
						class={[
							'cursor-pointer w-full px-4 py-2 rounded-lg text-left',
							command.selected ? 'text-zinc-800 bg-zinc-300' : ' text-zinc-200'
						]}
						><svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-5 inline mr-1"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6"
							/>
						</svg>

						{@html formatString(command.text)}
					</button>
				</div>
			{/each}
		</div>
	{/if}
{/each}
<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'ArrowDown':
				event.preventDefault();
				selectDataByIndex(selectedIndex + 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectDataByIndex(selectedIndex - 1);
				break;
		}
	}}
/>
