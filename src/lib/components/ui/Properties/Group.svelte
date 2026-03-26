<script lang="ts">
	import { createOrUpdateKeyframe, setParamsFromKeyframes } from '$lib/clip/keyframes';

	import { keyframeIcon } from '$lib/components/icons/Icons.svelte';
	import { historyManager, timelineState } from '$lib/state.svelte';
	import { setContext, type Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		label: string;
		className?: string[];
		keyframeParams?: number[];
	};
	let { children, label, className = [], keyframeParams }: Props = $props();

	let keyframeActive = $derived.by(() => {
		if (!keyframeParams) return false;
		return timelineState.selectedClip?.keyframeTracksActive.includes(keyframeParams[0]);
	});
	let keyframeOnThisFrame = $derived.by(() => {
		if (!keyframeParams) return false;
		return timelineState.selectedClip?.keyframesOnThisFrame.includes(keyframeParams[0]);
	});

	// eslint-disable-next-line svelte/no-unused-svelte-ignore
	// svelte-ignore state_referenced_locally
	setContext('keyframe', { params: keyframeParams, active: () => keyframeActive });
</script>

<div class="text-sm font-medium flex flex-col items-end w-full">
	<div class="select-none flex items-center">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		{#if keyframeParams && keyframeParams.length > 0}
			<span
				onclick={() => {
					if (keyframeParams) {
						createOrUpdateKeyframe(keyframeParams);
						historyManager.finishCommand();
						setParamsFromKeyframes();
						timelineState.invalidate = true;
					}
				}}
				class={[
					keyframeOnThisFrame
						? 'text-rose-500 duration-0'
						: keyframeActive
							? 'text-zinc-100 duration-200'
							: 'text-zinc-700 hover:text-zinc-400',
					'transition-colors'
				]}
			>
				{@render keyframeIcon('size-3 mr-2 my-1', keyframeOnThisFrame)}
			</span>
		{/if}
		{label}
	</div>
	<div class={['mt-2 flex flex-col items-end w-full gap-1 height-xl:gap-2', ...className]}>
		{@render children()}
	</div>
</div>
