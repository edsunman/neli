<script lang="ts">
	import { appState, timelineState, workerManager } from '$lib/state.svelte';
	import { Slider } from 'bits-ui';

	type Props = {
		value: number;
		orientation?: 'horizontal' | 'vertical';
		onValueChange: (n: number) => void;
	};

	let { value = $bindable(), orientation = 'horizontal' }: Props = $props();
</script>

<Slider.Root
	type="single"
	min={0}
	max={1}
	step={0.01}
	bind:value
	onValueChange={() => {
		if (timelineState.selectedClip) workerManager.sendClip(timelineState.selectedClip);
	}}
	{orientation}
	class="relative flex h-full touch-none select-none flex-col items-center group"
>
	<span
		class={[
			!appState.mouseIsDown && 'group-hover:bg-zinc-700',
			'bg-hover group-has-data-active:bg-zinc-700 relative h-full w-1',
			'cursor-pointer overflow-hidden rounded-full transition-colors duration-200',
			'group-has-data-active:duration-0 group-hover:duration-0'
		]}
	>
		<Slider.Range
			class={[
				!appState.mouseIsDown && 'group-hover:bg-zinc-400',
				'bg-zinc-700 group-has-data-active:bg-rose-600 absolute w-full',
				'left-0 transition-colors duration-200 group-has-data-active:duration-0 group-hover:duration-0'
			]}
		/>
	</span>
	<Slider.Thumb
		index={0}
		class={[
			!appState.mouseIsDown && 'group-hover:border-zinc-400',
			'data-active:border-rose-600 bg-zinc-900  ring-0 transition-colors',
			'duration-200 group-hover:duration-0 group-has-data-active:duration-0  border-3 border-zinc-700 rounded-full',
			'ring-offset-transparent focus-visible:ring-foreground focus-visible:outline-hidden block size-[14px] cursor-pointer '
		]}
	/>
</Slider.Root>
