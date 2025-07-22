<script lang="ts">
	import { createTextSource } from '$lib/source/actions';
	import { appState } from '$lib/state.svelte';
	import { untrack } from 'svelte';
	import { setCurrentFrame } from '$lib/timeline/actions';

	import TextIcon from '../icons/TextIcon.svelte';
	import TestIcon from '../icons/TestIcon.svelte';
	import ZoomInIcon from '../icons/ZoomInIcon.svelte';
	import ZoomOutIcon from '../icons/ZoomOutIcon.svelte';
	import ImportIcon from '../icons/ImportIcon.svelte';
	import ExportIcon from '../icons/ExportIcon.svelte';
	import SettingsIcon from '../icons/SettingsIcon.svelte';
	import SeekIcon from '../icons/SeekIcon.svelte';

	let { page = $bindable() } = $props();
	let inputValue = $state<string>();
	let selectedIndex = -1;
	let showSeekOptions = $state(false);
	let targetFrame = $state(0);
	let targetFrameFormatted = $state('');

	const categories = $state.raw([
		{
			id: 1,
			name: 'App',
			commands: [
				{
					id: 1,
					text: 'Import',
					selected: false,
					icon: ImportIcon,
					action: () => console.log(1)
				},
				{
					id: 2,
					text: 'Export',
					selected: false,
					icon: ExportIcon,
					action: () => (page = 'export')
				},
				{
					id: 3,
					text: 'Settings',
					selected: false,
					icon: SettingsIcon,
					action: () => console.log(2)
				},
				{
					id: 4,
					text: 'Welcome',
					selected: false,
					icon: TestIcon,
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
					icon: ZoomInIcon,
					action: () => console.log(1)
				},
				{
					id: 6,
					text: 'Zoom out',
					selected: false,
					icon: ZoomOutIcon,
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
					icon: TextIcon,
					action: () => {
						createTextSource();
						appState.showPalette = false;
					}
				},
				{
					id: 8,
					text: 'Add test card',
					selected: false,
					icon: TestIcon,
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

	// take string like 1s, 3m or 40f and return a frame number
	const parseInputNumbers = (inputNumbers: string) => {
		const lastChar = inputNumbers.slice(inputNumbers.length - 1);
		const onlyNumbers = Number(inputNumbers.replace(/[^0-9]/g, ''));
		if (lastChar === 'f') {
			targetFrame = onlyNumbers;
			targetFrameFormatted = `frame ${onlyNumbers}`;
		} else if (lastChar === 'm') {
			targetFrame = onlyNumbers * 30 * 60;
			targetFrameFormatted = `${onlyNumbers} minutes`;
		} else {
			targetFrame = onlyNumbers * 30;
			targetFrameFormatted = `${onlyNumbers} seconds`;
		}
		return;
	};

	$effect(() => {
		inputValue;
		untrack(() => {
			if (typeof inputValue === 'undefined') return;
			if (/^\d/.test(inputValue)) {
				showSeekOptions = true;
				parseInputNumbers(inputValue);
			} else {
				showSeekOptions = false;
			}
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

<div class="mx-8 flex-none">
	<!-- svelte-ignore a11y_autofocus -->
	<form
		onsubmit={() => {
			if (showSeekOptions) {
				setCurrentFrame(targetFrame);
				appState.showPalette = false;
			}
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
</div>

<div
	class="px-8 flex-1 overflow-y-scroll"
	style="scrollbar-color: #52525c #18181b; scrollbar-width:thin"
>
	{#each filtered as category}
		{#if category.commands.length > 0}
			<div class="mb-4">
				<div class="text-zinc-200 select-none text-sm mb-2">{category.name}</div>

				{#each category.commands as command}
					<!-- svelte-ignore a11y_mouse_events_have_key_events -->
					<button
						onmousemove={() => {
							if (!command.selected) selectDataById(command.id);
						}}
						onclick={command.action}
						class={[
							'cursor-pointer w-full p-2 rounded-lg text-left flex items-center',
							command.selected ? 'text-zinc-800 bg-zinc-300' : ' text-zinc-200'
						]}
					>
						<command.icon class="size-5 inline mr-2" />
						<p>{@html formatString(command.text)}</p>
					</button>
				{/each}
			</div>
		{/if}
	{/each}
	{#if showSeekOptions}
		<button
			class={[
				'cursor-pointer w-full p-2 rounded-lg text-left flex items-center',
				'text-zinc-800 bg-zinc-300'
			]}
		>
			<SeekIcon class="size-5 inline mr-2" />
			<!-- {@html formatString(command.text)} -->
			<p>Seek to {targetFrameFormatted}</p>
		</button>
	{/if}
</div>
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
