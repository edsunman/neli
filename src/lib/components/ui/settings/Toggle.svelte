<script lang="ts">
	import { timelineState } from '$lib/state.svelte';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		value: number;
		items: { value: number; icon: Snippet<[string]> }[];
	};
	let { value = $bindable(), items }: Props = $props();
</script>

<div class="bg-hover rounded-sm">
	{#each items as item}
		<button
			class={[item.value === value ? 'text-white' : '', 'py-1 px-1.5 ']}
			onclick={() => {
				value = item.value;
				updateWorkerClip(timelineState.selectedClip);
			}}>{@render item.icon('size-6')}</button
		>
	{/each}
</div>
