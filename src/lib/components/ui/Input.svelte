<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		value: string | number;
		fallback?: number | string;
		type?: 'text' | 'number';
		onBlur?: () => void;
		extention?: string;
		selectOnMount?: boolean;
	}

	let {
		value = $bindable(),
		fallback,
		onBlur = () => {},
		type = 'text',
		extention,
		selectOnMount = false,
		...others
	}: Props = $props();
</script>

<div
	class={[
		'rounded-lg relative overflow-hidden after:bg-linear-to-t z-0',
		// before
		'before:transition-all before:duration-200',
		"before:bg-hover before:content-[''] before:z-1 before:w-full before:h-full before:absolute before:left-0",
		'focus-within:before:duration-200 before:rounded-lg focus-within:before:-top-[3px] before:top-0',
		// after
		'after:from-rose-500 after:opacity-0  after:w-full after:h-full after:absolute after:left-0 ',
		"after:content-[''] after:transition-opacity focus-within:after:opacity-200 focus-within:after:duration-0 after:duration-500"
	]}
>
	{#if extention}
		<span class="pl-3 py-2 z-2 absolute text-zinc-400">
			<span class="text-hover">{value}</span>{extention}
		</span>
	{/if}
	<input
		{@attach (ref) => {
			if (selectOnMount) {
				ref.focus();
				ref.select();
			}
		}}
		bind:value
		type="text"
		class={['relative w-full px-3 py-2 z-2 text-zinc-100 outline-0']}
		onfocus={() => {
			appState.disableKeyboardShortcuts = true;
		}}
		onblur={() => {
			appState.disableKeyboardShortcuts = false;
			if (fallback) {
				if ((type === 'text' && value === '') || (type === 'number' && value === null)) {
					value = fallback;
				}
			}
			onBlur();
		}}
		{...others}
	/>
</div>
