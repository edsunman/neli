<script lang="ts">
	import {
		createOrUpdateKeyframe,
		finaliseKeyframe,
		setParamsFromKeyframes
	} from '$lib/clip/keyframes';
	import { getKeyframeContext } from '$lib/context/context';
	import { historyManager, projectManager, timelineState, workerManager } from '$lib/state.svelte';
	import { pause } from '$lib/timeline/actions';
	import Slider from '../Slider.svelte';

	let { value = $bindable(), ...props } = $props();

	const keyframeContext = getKeyframeContext();

	const onValueChange = () => {
		pause();
		if (keyframeContext.params && keyframeContext.active())
			createOrUpdateKeyframe(keyframeContext.params);
		if (timelineState.selectedClip) workerManager.sendClip(timelineState.selectedClip);
	};

	const onValueFinalised = () => {
		if (timelineState.selectedClip) projectManager.updateClip(timelineState.selectedClip);
		if (keyframeContext.params && keyframeContext.active()) {
			finaliseKeyframe();
			historyManager.finishCommand();
			setParamsFromKeyframes();
			timelineState.invalidate = true;
		}
	};
</script>

<Slider bind:value {onValueChange} {onValueFinalised} {...props} />
