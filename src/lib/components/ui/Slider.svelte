<script lang="ts">
	import { roundTo } from '$lib/clip/utils';
	import { useThrottle } from '$lib/hooks/useThrottle';
	import { appState } from '$lib/state.svelte';

	type Props = {
		value: number;
		min?: number;
		max?: number;
		barStart?: number;
		vertical?: boolean;
		onSlideStart?: (n: number) => void;
		onValueChange?: (n: number) => void;
		onValueFinalised?: () => void;
		step?: boolean;
	};

	let {
		value = $bindable(),
		vertical = false,
		min = 0,
		max = 1,
		barStart = 0,
		onSlideStart,
		onValueChange,
		onValueFinalised,
		step = false
	}: Props = $props();

	//const keyframeContext = getKeyframeContext();

	const throttle = useThrottle();
	const lerp = (min: number, max: number, value: number) => min + (max - min) * value;
	const invLerp = (min: number, max: number, value: number) => (value - min) / (max - min);
	const clamp = (value: number, max = 1, min = 0) => Math.min(Math.max(value, min), max);

	let dragging = $state(false);
	let clientStart = 0;
	let offsetStart = 0;
	let width = $state(0);
	let height = $state(0);

	let normalisedValue = $derived(invLerp(min, max, value));
	let barSize = $derived.by(() => {
		const barStartClamped = clamp(barStart, max, min);
		const barStartNormalised = invLerp(min, max, barStartClamped);
		const clampedValue = clamp(normalisedValue);
		const start = Math.min(barStartNormalised, clampedValue);
		const end = Math.max(barStartNormalised, clampedValue);
		return { start, width: end - start, handle: clampedValue };
	});
</script>

<div
	bind:clientWidth={width}
	bind:clientHeight={height}
	class={[vertical ? 'h-full mx-2' : 'w-full my-2', 'touch-none select-none group relative']}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class={[
			!vertical ? 'w-full h-1' : 'h-full w-1',
			!appState.mouseIsDown && 'group-hover:bg-zinc-700',
			dragging ? 'bg-zinc-700  duration-0' : 'duration-200 group-hover:duration-0',
			'transition-colors  bg-hover relative rounded-full'
		]}
		onmousedown={(e) => {
			e.preventDefault();
			dragging = true;
			if (onSlideStart) onSlideStart(value);
			let normalisedSize;
			if (!vertical) {
				clientStart = e.clientX;
				offsetStart = e.offsetX;
				normalisedSize = e.offsetX / width;
			} else {
				clientStart = e.clientY;
				offsetStart = e.offsetY;
				normalisedSize = 1 - e.offsetY / height;
			}
			const clamped = clamp(normalisedSize); // Math.min(Math.max(normalisedSize, 0), 1);
			const lerped = lerp(min, max, clamped);
			value = roundTo(lerped, 2);
			if (onValueChange) onValueChange(value);
		}}
	>
		<div
			style:width={`${!vertical ? barSize.width * 100 : 100}%`}
			style:left={`${!vertical ? barSize.start * 100 : 0}%`}
			style:height={`${vertical ? barSize.width * 100 : 100}%`}
			style:bottom={`${vertical ? barSize.start * 100 : 0}%`}
			class={[
				!appState.mouseIsDown && !dragging && 'group-hover:bg-zinc-400',
				dragging ? 'bg-rose-600  duration-0' : 'bg-zinc-600 duration-200 group-hover:duration-0',
				'h-full transition-colors absolute pointer-events-none rounded-full'
			]}
		></div>
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onmousedown={(e) => {
			e.preventDefault();
			dragging = true;
			clientStart = vertical ? e.clientY : e.clientX;
			let normalised;
			if (!vertical) {
				normalised = invLerp(min, max, value);
			} else {
				normalised = 1 - invLerp(min, max, value);
			}
			offsetStart = normalised * (vertical ? height : width);
			if (onSlideStart) onSlideStart(value);
			if (onValueChange) onValueChange(value);
		}}
		style:left={!vertical ? `${barSize.handle * 100}%` : ''}
		style:bottom={vertical ? `${barSize.handle * 100}%` : ''}
		class={[
			!vertical ? 'top-0.5 translate-[-7px]' : 'left-0.5 translate-y-[7px] translate-x-[-7px]',
			!appState.mouseIsDown && !dragging && 'group-hover:border-zinc-400',
			dragging
				? 'border-rose-600 duration-0'
				: 'border-zinc-600 duration-200 group-hover:duration-0',
			'bg-zinc-900 transition-colors border-3  rounded-full  size-[14px] absolute '
		]}
	></div>
</div>

<svelte:window
	onmousemove={(e) => {
		if (!dragging) return;

		throttle(() => {
			const moved = (!vertical ? e.clientX : e.clientY) - clientStart;
			const position = offsetStart + moved;
			let normalised;
			if (!vertical) {
				normalised = clamp(position / width);
			} else {
				normalised = 1 - clamp(position / height); //Math.min(Math.max(position / height, 0), 1);
			}
			const lerped = lerp(min, max, normalised);
			if (!step) {
				value = roundTo(lerped, 2);
			} else {
				value = Math.round(lerped);
			}

			if (onValueChange) onValueChange(value);
		});
	}}
	onmouseup={() => {
		if (dragging && onValueFinalised) onValueFinalised();
		dragging = false;
	}}
/>
