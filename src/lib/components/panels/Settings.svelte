<script lang="ts">
	import { timelineState } from '$lib/state.svelte';
	import { Slider } from 'bits-ui';
</script>

{#if !timelineState.selectedClip}
	<div class="flex flex-col mt-12 mr-[calc(100svw/20)] rounded text-zinc-500 text-right">
		<div class="text-lg">project name</div>
	</div>
{/if}

{#each timelineState.clips as clip}
	{#if clip.id === timelineState.selectedClip?.id}
		<div class="flex flex-col mt-12 mr-[calc(100svw/20)] ml-[30%] rounded text-zinc-500 text-right">
			<div class="text-lg">{clip.source.type}</div>
			<div class="flex flex-col gap-4 mt-4">
				<div class="flex items-center justify-between text-sm font-medium">
					<span>Volume</span>
					<span>50%</span>
				</div>
				<Slider.Root
					type="single"
					value={0.5}
					class="relative flex w-full touch-none select-none items-center"
				>
					<span
						class="bg-dark-10 relative h-1 w-full grow cursor-pointer overflow-hidden rounded-full"
					>
						<Slider.Range class="bg-white absolute h-full" />
					</span>
					<Slider.Thumb
						index={0}
						class={'border-border-input bg-background hover:border-dark-40 focus-visible:ring-foreground dark:bg-foreground dark:shadow-card data-active:border-dark-40 focus-visible:outline-hidden data-active:scale-[0.98] block size-[15px] cursor-pointer rounded-full border shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'}
					/>
				</Slider.Root>
			</div>
		</div>
	{/if}
{/each}
