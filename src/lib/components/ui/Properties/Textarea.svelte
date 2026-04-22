<script lang="ts">
	import { appState, timelineState, workerManager } from '$lib/state.svelte';
	import { onDestroy } from 'svelte';

	type Props = {
		value: string;
		fallback?: number | string;
		onBlur?: () => void;
	};
	let { value = $bindable(), onBlur = () => {} }: Props = $props();

	onDestroy(() => {
		onBlur();
	});
</script>

<div
	class={[
		'rounded-sm relative overflow-hidden z-0 w-full',
		'',
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
			'relative w-full resize-none h-17 px-2 py-1 z-2 text-zinc-300 focus:text-zinc-100 outline-0',
			'[&::-webkit-inner-spin-button]:appearance-none'
		]}
		onfocus={() => {
			appState.disableKeyboardShortcuts = true;
		}}
		onblur={() => {
			appState.disableKeyboardShortcuts = false;
			onBlur();
			if (!timelineState.selectedClip) return;
			if (value === '') {
				value = '_';
				workerManager.sendClip(timelineState.selectedClip);
			}
		}}
		oninput={() => {
			if (timelineState.selectedClip) workerManager.sendClip(timelineState.selectedClip);
		}}
		bind:value
	></textarea>
</div>
