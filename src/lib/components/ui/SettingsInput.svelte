<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';

	type Props = {
		value: any;
		fallback?: number | string;
		type?: 'text' | 'number';
	};
	let { value = $bindable(), fallback = 0, type = 'number' }: Props = $props();
</script>

<div
	class={[
		'rounded-sm relative overflow-hidden w-12',
		// before
		'before:transition-all before:duration-100',
		"before:bg-hover before:content-[''] before:z-1 before:w-full before:h-full before:absolute before:left-0",
		'focus-within:before:duration-200 before:rounded-sm focus-within:before:-top-[3px] before:top-0',
		// after
		'after:from-rose-500 after:opacity-0 after:w-full after:h-full after:absolute after:left-0  after:bg-linear-to-t',
		"after:content-[''] after:transition-opacity focus-within:after:opacity-100 focus-within:after:duration-0 after:duration-500"
	]}
>
	<input
		{type}
		class={[
			'relative w-full text-right px-1 py-1 z-2 text-zinc-400 focus:text-zinc-100 outline-0',
			'[&::-webkit-inner-spin-button]:appearance-none'
		]}
		onfocus={() => {
			appState.disableKeyboardShortcuts = true;
		}}
		onblur={() => {
			appState.disableKeyboardShortcuts = false;
			if ((type === 'text' && value === '') || (type === 'number' && value === null)) {
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
</div>
