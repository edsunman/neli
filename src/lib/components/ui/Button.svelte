<script lang="ts">
	let { onclick, text, disabled = false, ref = $bindable() } = $props();
</script>

<button
	bind:this={ref}
	{disabled}
	class={[
		'relative border-2 border-zinc-300 text-zinc-100 rounded-xl px-3 py-2 justify-self-end z-1 bg-rose-500',
		'overflow-hidden transition-colors focus:outline-none ',
		"before:content-[''] before:absolute before:w-full before:h-full before:bg-zinc-900",
		'before:bottom-0 before:left-0  before:-z-1',
		'before:transition-all before:ease-in-out before:duration-100',
		disabled
			? 'border-zinc-700 text-zinc-600'
			: 'cursor-pointer hover:before:bottom-0.5 hover:before:rounded-xl hover:border-rose-500 focus:border-rose-500'
	]}
	{onclick}
>
	{text}
</button>
