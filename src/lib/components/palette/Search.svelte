<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { pause, play, setCurrentFrame, zoomIn, zoomOut } from '$lib/timeline/actions';

	import InfoIcon from '../icons/InfoIcon.svelte';
	import ZoomInIcon from '../icons/ZoomInIcon.svelte';
	import ZoomOutIcon from '../icons/ZoomOutIcon.svelte';
	import ImportIcon from '../icons/ImportIcon.svelte';
	import ExportIcon from '../icons/ExportIcon.svelte';
	import SettingsIcon from '../icons/SettingsIcon.svelte';
	import SeekIcon from '../icons/SeekIcon.svelte';

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
					text: 'import',
					selected: false,
					icon: ImportIcon,
					shortcuts: ['I'],
					action: () => (appState.palettePage = 'import')
				},
				{
					id: 2,
					text: 'export',
					selected: false,
					icon: ExportIcon,
					shortcuts: ['E'],
					action: () => (appState.palettePage = 'export')
				},
				/* {
					id: 3,
					text: 'settings',
					selected: false,
					icon: SettingsIcon,
					shortcuts: [],
					action: () => console.log(2)
				}, */
				{
					id: 4,
					text: 'about',
					selected: false,
					icon: InfoIcon,
					shortcuts: [],
					action: () => (appState.palettePage = 'about')
				}
			]
		},
		{
			id: 2,
			name: 'Timeline',
			commands: [
				{
					id: 7,
					text: 'play / pause',
					selected: false,
					icon: ZoomOutIcon,
					shortcuts: ['Space'],
					action: () => {
						if (timelineState.playing) {
							pause();
						} else {
							play();
						}
						appState.showPalette = false;
					}
				},
				{
					id: 5,
					text: 'zoom in',
					selected: false,
					icon: ZoomInIcon,
					shortcuts: ['='],
					action: () => {
						zoomIn();
						appState.showPalette = false;
					}
				},
				{
					id: 6,
					text: 'zoom out',
					selected: false,
					icon: ZoomOutIcon,
					shortcuts: ['-'],
					action: () => {
						zoomOut();
						appState.showPalette = false;
					}
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

	const onInputChange = () => {
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
	};

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

	const seekEvent = () => {
		setCurrentFrame(targetFrame);
		appState.showPalette = false;
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
				seekEvent();
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
			oninput={onInputChange}
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
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						onmousemove={() => {
							if (!command.selected) selectDataById(command.id);
						}}
						onclick={() => {
							command.action();
						}}
						class={[
							'cursor-pointer w-full p-2 rounded-lg text-left flex items-center group',
							command.selected ? 'text-zinc-200 bg-hover' : ' text-zinc-200'
						]}
					>
						<command.icon class="size-5 inline mr-3" />
						<p class="flex-1">{@html formatString(command.text)}</p>
						{#each command.shortcuts as key}
							<div
								class={[
									'ml-2 text-sm  px-1.5 py-0.5 rounded-sm ',
									command.selected ? 'bg-zinc-700' : ' bg-zinc-800'
								]}
							>
								{key}
							</div>
						{/each}
					</div>
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
			onclick={seekEvent}
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
