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

	let { value = $bindable(), param = -1, ...props } = $props();
	let oldValue: number;

	const keyframeContext = getKeyframeContext();

	const onSlideStart = () => {
		oldValue = value;
	};

	const onValueChange = () => {
		pause();
		if (keyframeContext.params && keyframeContext.active())
			createOrUpdateKeyframe(keyframeContext.params);
		if (timelineState.selectedClip) workerManager.sendClip(timelineState.selectedClip);
	};

	const onValueFinalised = () => {
		if (!timelineState.selectedClip) return;
		projectManager.updateClip(timelineState.selectedClip);
		if (
			param > -1 &&
			!keyframeContext.active() &&
			typeof value === 'number' &&
			oldValue !== value
		) {
			historyManager.pushAction({
				action: 'clipParam',
				data: {
					clipId: timelineState.selectedClip.id,
					oldValue: [oldValue],
					newValue: [value],
					paramIndex: [param]
				}
			});
		}
		if (keyframeContext.params && keyframeContext.active()) {
			finaliseKeyframe();
			setParamsFromKeyframes();
			timelineState.invalidate = true;
		}
		historyManager.finishCommand();
	};
</script>

<Slider bind:value {onSlideStart} {onValueChange} {onValueFinalised} {...props} />
