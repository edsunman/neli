<script lang="ts">
	import { timelineState } from '$lib/state.svelte';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		value?: number;
		items: { value: number; icon: Snippet<[string]>; onClick?: () => void }[];
		updateWorker?: boolean;
	};
	let { value = $bindable(0), items, updateWorker = true }: Props = $props();

	let selectedIndex = $derived.by(() => {
		let index = 0;
		items.forEach((item, i) => {
			if (item.value === value) index = i;
		});
		return index;
	});
</script>

<div style:min-width={`${36 * items.length}px`} class="bg-hover rounded-sm relative z-0">
	{#each items as item}
		<button
			class={[
				item.value === value ? 'text-white' : 'hover:text-zinc-400',
				'py-1 px-1.5 z-2 relative '
			]}
			onclick={() => {
				value = item.value;
				if (item.onClick) item.onClick();
				if (updateWorker) updateWorkerClip(timelineState.selectedClip);
			}}>{@render item.icon('size-6')}</button
		>
	{/each}
	<div
		style:left={`${(100 / items.length) * selectedIndex}%`}
		style:width={`${100 / items.length}%`}
		class="bg-zinc-700 h-full absolute top-0 z-1 rounded-sm transition-[left] duration-50"
	></div>
</div>
