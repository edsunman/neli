<script lang="ts">
	import { timelineState } from '$lib/state.svelte';
	import { Slider, ToggleGroup } from 'bits-ui';
</script>

{#if !timelineState.selectedClip}
	<div class="flex flex-col mt-12 mr-[calc(100svw/20)] ml-[30%] rounded text-zinc-500 text-right">
		<div class="text-lg">project name</div>
		<div class="flex flex-col gap-3 mt-4">
			<div class="flex items-center justify-between text-sm font-medium">
				<span>Aspect ratio</span>
				<span>
					<ToggleGroup.Root type="multiple" class="flex items-center gap-x-1 px-[4px]">
						{#each { length: 3 } as _}
							<ToggleGroup.Item
								aria-label="toggle bold"
								value="bold"
								class="rounded-sm hover:bg-zinc-800 hover:text-white active:bg-zinc-700 data-[state=on]:bg-zinc-700 data-[state=off]:text-foreground-alt data-[state=on]:text-foreground active:data-[state=on]:bg-dark-10 inline-flex size-8 items-center justify-center transition-all"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class="size-6"
									><rect width="256" height="256" fill="none" /><rect
										x="78"
										y="32"
										width="100"
										height="192"
										rx="8"
										fill="none"
										stroke="currentColor"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="18"
									/></svg
								>
							</ToggleGroup.Item>
						{/each}
					</ToggleGroup.Root>
				</span>
			</div>
		</div>
	</div>
{/if}

{#each timelineState.clips as clip}
	{#if clip.id === timelineState.selectedClip?.id}
		<div class="flex flex-col mt-12 mr-[calc(100svw/20)] ml-[30%] rounded text-zinc-500 text-right">
			<div class="text-lg">{clip.source.type}</div>
			<div class="flex flex-col gap-3 mt-4">
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
						class="bg-zinc-700 relative h-1 w-full grow cursor-pointer overflow-hidden rounded-full"
					>
						<Slider.Range class="bg-rose-600 absolute h-full" />
					</span>
					<Slider.Thumb
						index={0}
						class={'bg-rose-600 ring-white focus-visible:ring-2  ring-offset-transparent focus-visible:ring-foreground focus-visible:outline-hidden block size-[15px] cursor-pointer rounded-full  '}
					/>
				</Slider.Root>
			</div>
		</div>
	{/if}
{/each}
