<script lang="ts">
	import { historyManager, projectManager, timelineState, workerManager } from '$lib/state.svelte';

	type Props = { value: number; param: number; options: { value: number; text: string }[] };
	let { value = $bindable(), param, options }: Props = $props();
	let oldValue = value;
</script>

<select
	bind:value
	class={[
		'block w-full p-2 rounded-lg text-zinc-300',
		'hover:border-zinc-500 border-2 border-zinc-800 focus:border-zinc-800',
		'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300'
		//'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300'
	]}
	onchange={() => {
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
>
	{#each options as option (option.value)}
		<option class="bg-zinc-900" value={option.value}>{option.text}</option>
	{/each}
</select>
