<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';

	type Props = {
		value: any;
		fallback?: number | string;
	};
	let { value = $bindable() }: Props = $props();
</script>

<div
	class={[
		'rounded-sm relative overflow-hidden z-0 ',
		// before
		'before:transition-all before:duration-200',
		"before:bg-hover before:content-[''] before:z-1 before:w-full before:h-full before:absolute before:left-0",
		'focus-within:before:duration-200 before:rounded-sm focus-within:before:-top-[3px] before:top-0',
		// after
		'after:from-rose-500 after:opacity-0 after:w-full after:h-full after:absolute after:left-0  after:bg-linear-to-t',
		"after:content-[''] after:transition-opacity focus-within:after:opacity-100 focus-within:after:duration-0 after:duration-500"
	]}
>
	<textarea
		class={[
			'relative w-full resize-none h-17 px-2 py-1 z-2 text-zinc-400 focus:text-zinc-100 outline-0',
			'[&::-webkit-inner-spin-button]:appearance-none'
		]}
		onfocus={() => {
			appState.disableKeyboardShortcuts = true;
		}}
		onblur={() => {
			appState.disableKeyboardShortcuts = false;
			if (value === '') {
				value = '_';
				updateWorkerClip(timelineState.selectedClip);
			}
		}}
		oninput={() => {
			updateWorkerClip(timelineState.selectedClip);
		}}
		bind:value
	></textarea>
</div>
