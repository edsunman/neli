<script lang="ts">
	import { historyManager, projectManager, timelineState, workerManager } from '$lib/state.svelte';

	let { value = $bindable(), param } = $props();
	let oldValue = value;
</script>

<select
	bind:value
	class="block w-full p-2 rounded-lg border border-zinc-600 text-zinc-300"
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
	<option class="bg-zinc-900" value={1}>Sen</option>
	<option class="bg-zinc-900" value={2}>Montserrat</option>
</select>
