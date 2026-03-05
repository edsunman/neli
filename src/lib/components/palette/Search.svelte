<script lang="ts">
	import { appState, historyManager, programState, timelineState } from '$lib/state.svelte';
	import {
		centerViewOnPlayhead,
		focusTrack,
		pause,
		play,
		setCurrentFrame,
		zoomIn,
		zoomOut
	} from '$lib/timeline/actions';
	import { onMount } from 'svelte';
	import { stringToFramesAndSynopsis } from '$lib/timeline/utils';

	import {
		infoIcon,
		zoomInIcon,
		zoomOutIcon,
		importIcon,
		exportIcon,
		helpIcon,
		seekIcon,
		playIcon,
		backIcon,
		undoIcon,
		redoIcon,
		forwardIcon,
		fileOpenIcon,
		fileNewIcon
	} from '../icons/Icons.svelte';
	import { pauseProgram, playProgram } from '$lib/program/actions';
	import { createNewProject, createProjectThumbnail } from '$lib/project/actions';

	let searchInput = $state<HTMLInputElement>();
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
					icon: importIcon,
					shortcuts: ['N'],
					action: () => {
						appState.import.importStarted = false;
						appState.palette.page = 'import';
					}
				},
				{
					id: 102,
					text: 'export',
					selected: false,
					icon: exportIcon,
					shortcuts: ['M'],
					action: () => (appState.palette.page = 'export')
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
					icon: infoIcon,
					shortcuts: [],
					action: () => (appState.palette.page = 'about')
				},
				{
					id: 105,
					text: 'help',
					selected: false,
					icon: helpIcon,
					shortcuts: [],
					action: () => {
						window.open('https://neli.video/docs/getting-started', '_blank');
						appState.palette.open = false;
					}
				},
				{
					id: 106,
					text: 'undo',
					selected: false,
					icon: undoIcon,
					shortcuts: ['ctrl', 'Z'],
					action: () => {
						focusTrack(0);
						historyManager.undo();
						appState.palette.open = false;
					}
				},
				{
					id: 107,
					text: 'redo',
					selected: false,
					icon: redoIcon,
					shortcuts: ['ctrl', 'alt', 'Z'],
					action: () => {
						focusTrack(0);
						historyManager.redo();
						appState.palette.open = false;
					}
				}
			]
		},
		{
			id: 2,
			name: 'Project',
			commands: [
				{
					id: 201,
					text: 'new project',
					selected: false,
					icon: fileNewIcon,
					shortcuts: [],
					action: async () => {
						await createProjectThumbnail();
						createNewProject();
						appState.palette.open = false;
					}
				},
				{
					id: 202,
					text: 'load project',
					selected: false,
					icon: fileOpenIcon,
					shortcuts: [],
					action: () => {
						appState.palette.page = 'projects';
					}
				}
			]
		},
		{
			id: 3,
			name: 'Timeline',
			commands: [
				{
					id: 301,
					text: 'play / pause',
					selected: false,
					icon: playIcon,
					shortcuts: ['space'],
					action: () => {
						if (timelineState.playing || programState.playing) {
							if (appState.selectedSource) {
								pauseProgram();
							} else {
								pause();
							}
						} else {
							if (appState.selectedSource) {
								playProgram();
							} else {
								play();
							}
						}
						appState.palette.open = false;
					}
				},
				{
					id: 302,
					text: 'zoom in',
					selected: false,
					icon: zoomInIcon,
					shortcuts: ['='],
					action: () => {
						zoomIn();
						appState.palette.open = false;
					}
				},
				{
					id: 303,
					text: 'zoom out',
					selected: false,
					icon: zoomOutIcon,
					shortcuts: ['-'],
					action: () => {
						zoomOut();
						appState.palette.open = false;
					}
				},
				{
					id: 304,
					text: 'one frame forward',
					selected: false,
					icon: forwardIcon,
					shortcuts: ['right arrow'],
					action: () => {
						setCurrentFrame(timelineState.currentFrame + 1);
						appState.palette.open = false;
					}
				},
				{
					id: 305,
					text: 'one frame back',
					selected: false,
					icon: backIcon,
					shortcuts: ['left arrow'],
					action: () => {
						setCurrentFrame(timelineState.currentFrame - 1);
						appState.palette.open = false;
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
	let allCategoriesEmpty = $derived(filtered.every((category) => category.commands.length === 0));

	const parseInputNumbers = (inputString: string) => {
		const { frames, synopsis } = stringToFramesAndSynopsis(inputString);
		targetFrame = frames;
		targetFrameFormatted = synopsis;
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
			selectByIndex(0);
		} else if (filteredCount > 0) selectByIndex(0);
	};

	const selectByIndex = (index: number) => {
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

	const selectById = (id: number) => {
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
		appState.palette.open = false;
		centerViewOnPlayhead();
	};

	const formatString = (string: string) => {
		const reg = new RegExp(inputValue ?? '', 'gi');
		return string.replace(reg, function (str) {
			return '<span class="underline">' + str + '</span>';
		});
	};

	onMount(() => {
		searchInput?.focus();
	});
</script>

<div class="mx-8 flex-none">
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
			bind:this={searchInput}
			bind:value={inputValue}
			oninput={onInputChange}
			class="placeholder-zinc-500 placeholder:text-lg w-full py-5 text-zinc-50 focus:outline-hidden text-xl"
			type="text"
			placeholder="Search (or type number to seek)"
		/>
	</form>
</div>
<div class="flex-1 bg-zinc-900 rounded-2xl overflow-y-hidden">
	<div
		bind:this={scrollDiv}
		class="px-8 overflow-y-scroll h-full"
		style="scrollbar-color: #52525c #18181b; scrollbar-width:thin"
	>
		{#each filtered as category (category.id)}
			{#if category.commands.length > 0}
				<div class="mb-4">
					<div class="text-zinc-200 select-none text-sm mb-2 first:mt-4">
						{category.name}
					</div>

					{#each category.commands as command (command.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							id={`command-${command.id}`}
							onmousemove={() => {
								if (!command.selected) selectById(command.id);
							}}
							onclick={() => {
								command.action();
							}}
							class={[
								'cursor-pointer w-full px-2 py-2.5 rounded-lg text-left flex items-center group',
								command.selected ? 'text-zinc-200 bg-hover' : ' text-zinc-200'
							]}
						>
							{@render command.icon('size-5 inline mr-3')}
							<!--  eslint-disable-next-line svelte/no-at-html-tags -->
							<p class="flex-1">{@html formatString(command.text)}</p>
							{#each command.shortcuts as key (key)}
								<!-- {#if i > 0}<span class="text-zinc-400 mx-1">+</span>{/if} -->
								<div
									class={[
										'text-sm px-1.5 py-0.5 rounded-sm mx-1 border-1',
										command.selected
											? 'border-zinc-500 text-zinc-400'
											: 'border-zinc-700 text-zinc-600'
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
			<div class="text-zinc-200 select-none text-sm mb-2 first:mt-4">Timeline</div>
			<button
				class={[
					'cursor-pointer w-full px-2 py-2.5 rounded-lg text-left flex items-center',
					'text-zinc-200 bg-hover'
				]}
				onclick={seekEvent}
			>
				{@render seekIcon('size-5 inline mr-2')}
				<p>{targetFrameFormatted}</p>
			</button>
		{/if}
		{#if allCategoriesEmpty}
			<div class="text-zinc-200 select-none text-sm mt-6 mb-2">No results</div>
		{/if}
	</div>
</div>
<svelte:window
	onkeydown={(event) => {
		switch (event.code) {
			case 'ArrowDown':
				event.preventDefault();
				selectByIndex(selectedIndex + 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectByIndex(selectedIndex - 1);
				break;
		}
	}}
/>
