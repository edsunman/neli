<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		value: any;
		fallback?: number | string;
		type?: string;
	}

	let { value = $bindable(), ...others }: Props = $props();
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
	<!-- svelte-ignore a11y_autofocus -->
	<input
		autofocus
		bind:value
		type="text"
		class={['relative w-full px-3 py-2 z-2 text-zinc-100 outline-0']}
		onfocus={() => {
			appState.disableKeyboardShortcuts = true;
		}}
		onblur={() => {
			appState.disableKeyboardShortcuts = false;
		}}
		{...others}
	/>
</div>
