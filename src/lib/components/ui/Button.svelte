<script lang="ts">
	let { onclick, text, disabled = false } = $props();
</script>

<button
	{disabled}
	class={[
		'border-2 border-zinc-300 text-zinc-100 rounded-lg px-3 py-2 justify-self-end',
		disabled ? 'border-zinc-700 text-zinc-600' : 'cursor-pointer'
	]}
	{onclick}
>
	{text}
</button>
