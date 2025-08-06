<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';

	let { value = $bindable(), fallback = 0 } = $props();
</script>

<input
	type="number"
	class={[
		'bg-hover w-12 text-right px-1 py-0.5 rounded-sm ml-2 text-zinc-400 focus:text-zinc-100 outline-0',
		'[&::-webkit-inner-spin-button]:appearance-none'
	]}
	onfocus={() => {
		appState.disableKeyboardShortcuts = true;
	}}
	onblur={() => {
		appState.disableKeyboardShortcuts = false;
		if (!value) {
			value = fallback;
			updateWorkerClip(timelineState.selectedClip);
		}
	}}
	oninput={() => {
		updateWorkerClip(timelineState.selectedClip);
	}}
	step=".01"
	bind:value
/>
