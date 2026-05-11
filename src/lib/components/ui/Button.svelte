<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onclick,
		text,
		disabled = false,
		ref = $bindable(),
		className = '',
		focusOnMount = false,
		icon,
		large = false
	}: {
		onclick: () => void;
		text: string;
		disabled?: boolean;
		ref?: HTMLButtonElement;
		className?: string;
		focusOnMount?: boolean;
		icon?: Snippet<[string]>;
		large?: boolean;
	} = $props();
</script>

<!-- svelte-ignore a11y_autofocus -->
<button
	bind:this={ref}
	autofocus={focusOnMount}
	{disabled}
	class={[
		className,
		large
			? 'px-4 py-3 border-2 rounded-3xl hover:before:rounded-3xl'
			: 'px-3 py-2 border-2 rounded-xl hover:before:rounded-xl',
		'relative border-zinc-400 text-zinc-100 justify-self-end z-1 bg-linear-to-r from-rose-500 to-pink-600',
		'overflow-hidden transition-colors focus:outline-none ',
		"before:content-[''] before:absolute before:w-full before:h-full before:bg-zinc-900",
		'before:bottom-0 before:left-0 before:-z-4',
		'before:transition-all before:ease-in-out before:duration-100',
		'ring-offset-zinc-900 ring-offset-2',
		disabled
			? 'border-zinc-700 text-zinc-600'
			: 'cursor-pointer hover:before:bottom-0.5  hover:border-rose-500 focus-visible:ring-rose-500 focus-visible:ring-2'
	]}
	{onclick}
>
	{#if icon}{@render icon('size-5 inline mr-2 mb-[2px]')}{/if}
	{text}
</button>
