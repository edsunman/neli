<script lang="ts">
	import { backArrowIcon } from '../icons/Icons.svelte';
	let { onclick, disabled = false, title } = $props();
</script>

<div class="mx-8 flex-none flex py-5 items-center text-zinc-50">
	<button
		{onclick}
		class={[
			disabled ? 'opacity-0' : 'opacity-100',
			'mr-2 pt-[2px] starting:opacity-0 transition-opacity delay-100 text-zinc-500 hover:text-zinc-50'
		]}
	>
		{@render backArrowIcon('size-4')}
	</button>

	<h1 class="text-xl starting:transform-[translateX(-24px)] transition-transform">{title}</h1>
</div>
