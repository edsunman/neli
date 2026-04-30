<script lang="ts">
	import type { Clip } from '$lib/clip/clip.svelte';
	import { createOrUpdateKeyframe, finaliseKeyframe } from '$lib/clip/keyframes';
	import { getKeyframeContext } from '$lib/context/context';
	import {
		appState,
		historyManager,
		projectManager,
		timelineState,
		workerManager
	} from '$lib/state.svelte';

	type Props = {
		value: number | string;
		fallback?: number | string;
		type?: 'text' | 'number';
		fullWidth?: boolean;
		onBlur?: () => void;
		step?: string;
		param?: number;
	};
	let {
		value = $bindable(),
		fallback = 0,
		type = 'number',
		fullWidth = false,
		onBlur = () => {},
		step = '.01',
		param = -1
	}: Props = $props();

	const keyframeContext = getKeyframeContext();
	let oldValue: number;
	let selectedClip: Clip;
</script>

<div
	class={[
		fullWidth ? '' : 'w-12',
		'rounded-sm relative overflow-hidden z-0',
		// before
		'before:transition-all before:duration-200',
		"before:bg-hover before:content-[''] before:z-1 before:w-full before:h-full before:absolute before:left-0",
		'focus-within:before:duration-200 before:rounded-sm focus-within:before:-top-[3px] before:top-0',
		// after
		'after:from-rose-500 after:opacity-0 after:w-full after:h-full after:absolute after:left-0  after:bg-linear-to-t',
		"after:content-[''] after:transition-opacity focus-within:after:opacity-100 focus-within:after:duration-0 after:duration-500"
	]}
>
	<input
		{type}
		{step}
		class={[
			type === 'number' ? 'py-0.5' : 'py-1',
			'relative w-full text-sm text-right height-xl:py-1 px-1 z-2 text-zinc-300 focus:text-zinc-100 outline-0',
			'[&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]'
		]}
		onfocus={() => {
			appState.disableKeyboardShortcuts = true;
			if (!timelineState.selectedClip) return;
			selectedClip = timelineState.selectedClip;
			if (keyframeContext.active() && keyframeContext.params) {
				appState.selectedKeyframeParam = keyframeContext.params[0];
			} else {
				appState.selectedKeyframeParam = -1;
			}

			if (type === 'number' && typeof value === 'number') {
				oldValue = value;
			}
			timelineState.invalidate = true;
		}}
		onblur={() => {
			appState.disableKeyboardShortcuts = false;
			onBlur();
			if (!selectedClip) return;
			// fallback value
			if ((type === 'text' && value === '') || (type === 'number' && value === null)) {
				value = fallback;
				workerManager.sendClip(selectedClip);
			}
			projectManager.updateClip(selectedClip);
			if (
				param > -1 &&
				!keyframeContext.active() &&
				typeof value === 'number' &&
				oldValue !== value
			) {
				historyManager.pushAction({
					action: 'clipParam',
					data: {
						clipId: selectedClip.id,
						oldValue: [oldValue],
						newValue: [value],
						paramIndex: [param]
					}
				});
			}
			if (keyframeContext.params && keyframeContext.active()) {
				finaliseKeyframe();
			}
			historyManager.finishCommand();
		}}
		oninput={() => {
			if (keyframeContext.params && keyframeContext.active()) {
				createOrUpdateKeyframe(keyframeContext.params);
			}

			if (timelineState.selectedClip) workerManager.sendClip(timelineState.selectedClip);
		}}
		bind:value
	/>
</div>
