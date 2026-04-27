<script lang="ts">
	import { Progress } from 'bits-ui';

	let { message, percentage }: { message: string; percentage: number } = $props();
</script>

<div class="flex w-full flex-col gap-4">
	<div class="flex items-center justify-between text-sm font-medium text-white">
		<span>{message}</span>
		<span>{Math.round(percentage)}%</span>
	</div>
	<Progress.Root
		value={percentage}
		max={100}
		class="bg-zinc-700 shadow-mini-inset relative h-[5px] w-full overflow-hidden rounded-full"
	>
		<div
			class="bg-rose-500 shadow-mini-inset h-full w-full flex-1 rounded-full transition-transform duration-500"
			style={`transform: translateX(-${100 - (100 * (percentage ?? 0)) / 100}%)`}
		></div>
	</Progress.Root>
</div>
