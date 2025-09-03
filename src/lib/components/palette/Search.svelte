<script lang="ts">
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import {
		centerViewOnPlayhead,
		pause,
		play,
		setCurrentFrame,
		zoomIn,
		zoomOut
	} from '$lib/timeline/actions';

	import InfoIcon from '../icons/InfoIcon.svelte';
	import ZoomInIcon from '../icons/ZoomInIcon.svelte';
	import ZoomOutIcon from '../icons/ZoomOutIcon.svelte';
	import ImportIcon from '../icons/ImportIcon.svelte';
	import ExportIcon from '../icons/ExportIcon.svelte';
	import SettingsIcon from '../icons/SettingsIcon.svelte';
	import SeekIcon from '../icons/SeekIcon.svelte';
	import PlayIcon from '../icons/PlayIcon.svelte';
	import ForwardIcon from '../icons/ForwardIcon.svelte';
	import BackIcon from '../icons/BackIcon.svelte';
	import UndoIcon from '../icons/UndoIcon.svelte';
	import RedoIcon from '../icons/RedoIcon.svelte';

	let inputValue = $state<string>();
	let selectedIndex = 0;
	let showSeekOptions = $state(false);
	let targetFrame = $state(0);
	let targetFrameFormatted = $state('');
	let scrollDiv = $state<HTMLDivElement>();

	const categories = $state.raw([
		{
			id: 1,
			name: 'App',
			commands: [
				{
					id: 101,
					text: 'import',
					selected: true,
					icon: ImportIcon,
					shortcuts: ['I'],
					action: () => (appState.palettePage = 'import')
				},
				{
					id: 102,
					text: 'export',
					selected: false,
					icon: ExportIcon,
					shortcuts: ['E'],
					action: () => (appState.palettePage = 'export')
				},
				/* {
					id: 103,
					text: 'settings',
					selected: false,
					icon: SettingsIcon,
					shortcuts: [],
					action: () => console.log(2)
				}, */
				{
					id: 104,
					text: 'about',
					selected: false,
					icon: InfoIcon,
					shortcuts: [],
					action: () => (appState.palettePage = 'about')
				},
				{
					id: 105,
					text: 'undo',
					selected: false,
					icon: UndoIcon,
					shortcuts: ['ctrl', 'Z'],
					action: () => {
						historyManager.undo();
						appState.showPalette = false;
					}
				},
				{
					id: 106,
					text: 'redo',
					selected: false,
					icon: RedoIcon,
					shortcuts: ['ctrl', 'alt', 'Z'],
					action: () => {
						historyManager.redo();
						appState.showPalette = false;
					}
				}
			]
		},
		{
			id: 2,
			name: 'Timeline',
			commands: [
				{
					id: 201,
					text: 'play / pause',
					selected: false,
					icon: PlayIcon,
					shortcuts: ['space'],
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
					id: 202,
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
					id: 203,
					text: 'zoom out',
					selected: false,
					icon: ZoomOutIcon,
					shortcuts: ['-'],
					action: () => {
						zoomOut();
						appState.showPalette = false;
					}
				},
				{
					id: 204,
					text: 'one frame forward',
					selected: false,
					icon: ForwardIcon,
					shortcuts: ['right arrow'],
					action: () => {
						setCurrentFrame(timelineState.currentFrame + 1);
						appState.showPalette = false;
					}
				},
				{
					id: 205,
					text: 'one frame back',
					selected: false,
					icon: BackIcon,
					shortcuts: ['left arrow'],
					action: () => {
						setCurrentFrame(timelineState.currentFrame - 1);
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
			selectDataByIndex(0);
		} else if (filteredCount > 0) selectDataByIndex(0);
	};

	const selectDataByIndex = (index: number) => {
		let filteredCount = 0;
		filtered.forEach((category) => {
			filteredCount += category.commands.length;
		});
		if (index < 0) {
			index = filteredCount - 1;
		}
		if (filteredCount < index + 1) {
			index = 0;
		}
		let i = 0;
		let commandId = 0;
		filtered.forEach((category) => {
			category.commands.forEach((command) => {
				if (command.selected) command.selected = false;
				if (index === i) {
					command.selected = true;
					selectedIndex = index;
					commandId = command.id;
				}
				i++;
			});
		});
		filtered = [...filtered];
		// keyboard scroll
		const element = document.getElementById(`command-${commandId}`);
		if (!element || !scrollDiv) return;
		const rect = element.getBoundingClientRect();
		const scrollRect = scrollDiv.getBoundingClientRect();
		if (rect.bottom > scrollRect.bottom) {
			element.scrollIntoView(false);
		}
		if (rect.top < scrollRect.top) {
			element.scrollIntoView();
		}
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
		centerViewOnPlayhead();
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
			class="placeholder-zinc-500 placeholder:text-lg w-full py-5 text-zinc-50 focus:outline-hidden text-xl"
			type="text"
			placeholder="Search commands, type number to seek"
			autofocus
		/>
	</form>
</div>

<div
	bind:this={scrollDiv}
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
						id={`command-${command.id}`}
						onmousemove={() => {
							if (!command.selected) selectDataById(command.id);
						}}
						onclick={() => {
							command.action();
						}}
						class={[
							'cursor-pointer w-full px-2 py-2.5 rounded-lg text-left flex items-center group',
							command.selected ? 'text-zinc-200 bg-hover' : ' text-zinc-200'
						]}
					>
						<command.icon class="size-5 inline mr-3" />
						<p class="flex-1">{@html formatString(command.text)}</p>
						{#each command.shortcuts as key, i}
							{#if i > 0}<span class="text-zinc-400 mx-1">+</span>{/if}
							<div
								class={[
									'text-sm  px-1.5 py-0.5 rounded-sm ',
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
				'text-zinc-200 bg-hover'
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
