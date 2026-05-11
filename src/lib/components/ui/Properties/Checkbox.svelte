<script lang="ts">
	import { checkIcon } from '$lib/components/icons/Icons.svelte';
	import { historyManager, projectManager, timelineState, workerManager } from '$lib/state.svelte';
	import { pause } from '$lib/timeline/actions';
	import { Checkbox } from 'bits-ui';

	let { value = $bindable(), param } = $props();
	let oldValue = value;
</script>

<Checkbox.Root
	bind:checked={
		() => (value === 0 ? false : true),
		(checked) => {
			value = checked ? 1 : 0;
		}
	}
	onCheckedChange={() => {
		pause();
		if (!timelineState.selectedClip) return;
		const clip = timelineState.selectedClip;
		historyManager.newCommand({
			action: 'clipParam',
			data: {
				clipId: clip.id,
				oldValue: [oldValue],
				newValue: [value],
				paramIndex: [param]
			}
		});
		oldValue = value;
		projectManager.updateClip(clip);
		workerManager.sendClip(clip);
	}}
	class={[
		'bg-zinc-400 border-zinc-400',
		'data-[state=unchecked]:border-zinc-600 data-[state=unchecked]:bg-zinc-900 data-[state=unchecked]:hover:border-zinc-400',
		'focus-visible:outline-hidden focus-visible:ring-2 rounded-lg ring-zinc-300',
		'peer inline-flex size-[22px] items-center justify-center rounded-md border-2',
		'transition-all duration-150 ease-in-out'
	]}
>
	{#snippet children({ checked })}
		<div class="text-zinc-900 inline-flex items-center justify-center">
			{#if checked}
				{@render checkIcon('size-5')}
			{/if}
		</div>
	{/snippet}
</Checkbox.Root>
