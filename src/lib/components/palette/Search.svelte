<script lang="ts">
	import { untrack } from 'svelte';

	let { page = $bindable() } = $props();
	let inputValue = $state<string>();
	let selectedIndex = -1;

	const commands = $state.raw([
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
	]);
	let filtered = $derived.by(() => {
		return commands.filter((command) =>
			command.text.toLowerCase().includes(inputValue?.toLowerCase() ?? '')
		);
	});

	$effect(() => {
		inputValue;
		untrack(() => {
			if (typeof inputValue === 'undefined') return;
			if (inputValue.length < 1) {
				selectDataById(-1);
			} else if (filtered.length > 0) selectDataById(filtered[0].id);
		});
	});

	const selectDataByIndex = (index: number) => {
		if (index < 0 || filtered.length < index + 1) return;
		filtered.forEach((command, i) => {
			if (command.selected) command.selected = false;
			if (index === i) {
				command.selected = true;
				selectedIndex = index;
			}
		});
		filtered = [...filtered];
	};

	const selectDataById = (id: number) => {
		filtered.forEach((command, index) => {
			if (command.selected) command.selected = false;
			if (command.id === id) {
				command.selected = true;
				selectedIndex = index;
			}
		});
		filtered = [...filtered];
	};

	const formatString = (string: string) => {
		console.log('d');
		const reg = new RegExp(inputValue ?? '', 'gi');
		return string.replace(reg, function (str) {
			return '<span class="font-bold">' + str + '</span>';
		});
		/*if (!string || string.length < 1 || !inputValue) return string;
		 let newString = string.replace(
			inputValue.toLowerCase(),
			`<span class="text-rose-400">${inputValue.toLowerCase()}</span>`
		);
		newString = string.replace(
			inputValue.toUpperCase(),
			`<span class="text-rose-400">${inputValue.toUpperCase()}</span>`
		);
		return newString; */
	};
</script>

<!-- svelte-ignore a11y_autofocus -->
<form
	onsubmit={() => {
		for (const command of filtered) {
			if (command.selected && command.action) {
				command.action();
				break;
			}
		}
	}}
>
	<input
		bind:value={inputValue}
		class="placeholder-zinc-500 w-full p-5 text-zinc-50 focus:outline-hidden"
		type="text"
		placeholder="Search commands"
		autofocus
	/>
</form>
{#each filtered as data}
	<div class="my-2">
		<!-- svelte-ignore a11y_mouse_events_have_key_events -->
		<button
			onmousemove={() => {
				if (!data.selected) selectDataById(data.id);
			}}
			onclick={data.action}
			class={[
				'cursor-pointer w-full px-5 py-3 rounded-lg text-left',
				data.selected ? 'text-zinc-800 bg-zinc-300' : 'bg-zinc-800 text-zinc-300'
			]}
		>
			{@html formatString(data.text)}
		</button>
	</div>
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
