<script lang="ts">
	import { historyManager, projectManager, timelineState, workerManager } from '$lib/state.svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		value?: number;
		items: { value: number; icon: Snippet<[string]>; onClick?: () => void }[];
		updates?: 'none' | 'project' | 'clip';
	};
	let { value = $bindable(0), items, updates = 'none' }: Props = $props();
	let oldValue = 0;

	let selectedIndex = $derived.by(() => {
		let index = 0;
		items.forEach((item, i) => {
			if (item.value === value) index = i;
		});
		return index;
	});
</script>

<div style:min-width={`${36 * items.length}px`} class="bg-hover rounded-sm relative z-0">
	{#each items as item (item.value)}
		<button
			class={[
				item.value === value ? 'text-white' : 'hover:text-zinc-400',
				'py-1 px-1.5 z-2 relative '
			]}
			onmousedown={() => {
				oldValue = value;
			}}
			onclick={() => {
				value = item.value;
				if (item.onClick) item.onClick();
				if (updates === 'project') {
					const oldHeight = oldValue === 2 ? 1920 : 1080;
					const oldWidth = oldValue === 0 ? 1920 : 1080;
					const newHeight = value === 2 ? 1920 : 1080;
					const newWidth = value === 0 ? 1920 : 1080;
					historyManager.newCommand({
						action: 'updateProject',
						data: {
							oldApsect: oldValue,
							oldHeight,
							oldWidth,
							newAspect: value,
							newHeight,
							newWidth
						}
					});
					projectManager.updateProject({ aspect: value });
				}
				if (updates === 'clip' && timelineState.selectedClip) {
					workerManager.sendClip(timelineState.selectedClip);
				}
			}}>{@render item.icon('size-6')}</button
		>
	{/each}
	<div
		style:left={`${(100 / items.length) * selectedIndex}%`}
		style:width={`${100 / items.length}%`}
		class="bg-zinc-700 h-full absolute top-0 z-1 rounded-sm transition-[left] duration-50"
	></div>
</div>
