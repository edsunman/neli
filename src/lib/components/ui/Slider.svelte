<script lang="ts">
	import { Slider } from 'bits-ui';

	let { value = $bindable(), onValueChange } = $props();
</script>

<Slider.Root
	type="single"
	min={0}
	max={1}
	step={0.01}
	bind:value
	{onValueChange}
	orientation="vertical"
	class="relative flex h-full touch-none select-none flex-col items-center group"
>
	<span
		class="bg-hover group-hover:bg-zinc-700 group-has-data-active:bg-zinc-700 relative h-full w-1 cursor-pointer overflow-hidden rounded-full transition-colors duration-200 group-has-data-active:duration-0 group-hover:duration-0"
	>
		<Slider.Range
			class="bg-zinc-700 group-hover:bg-zinc-400 group-has-data-active:bg-rose-600 absolute w-full left-0 transition-colors duration-200 group-has-data-active:duration-0 group-hover:duration-0"
		/>
	</span>
	<Slider.Thumb
		index={0}
		class={'data-active:border-rose-600 bg-zinc-900 group-hover:border-zinc-400 ring-0 transition-colors duration-200 group-hover:duration-0 group-has-data-active:duration-0  border-3 border-zinc-700 ring-offset-transparent focus-visible:ring-foreground focus-visible:outline-hidden block size-[14px] cursor-pointer rounded-full'}
	/>
</Slider.Root>
