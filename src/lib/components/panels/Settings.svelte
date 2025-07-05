<script lang="ts">
	import { updateWorkerClip } from '$lib/worker/actions';
	import { appState, timelineState } from '$lib/state.svelte';
	import { Slider, ToggleGroup } from 'bits-ui';
	import { untrack } from 'svelte';

	$effect(() => {
		timelineState.selectedClip?.scaleX;
		timelineState.selectedClip?.scaleY;
		timelineState.selectedClip?.positionX;
		timelineState.selectedClip?.positionY;
		untrack(() => {
			if (timelineState.selectedClip) updateWorkerClip(timelineState.selectedClip);
		});
	});
</script>

<div class="flex flex-col mt-12 mr-[calc(100svw/20)] rounded text-zinc-500 text-right pr-2">
	<div class="absolute right-[calc(100svw/20-50px)] flex flex-col bg-[#131315] rounded">
		{#each { length: 3 } as _}
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<button class="p-2 text-zinc-600 hover:text-zinc-400">
				<svg
					role="img"
					xmlns="http://www.w3.org/2000/svg"
					width="25px"
					height="25px"
					viewBox="0 0 24 24"
					aria-labelledby="folderIconTitle"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					fill="none"
				>
					<path d="M13 5v14l-5-4H3V9h5z" />
					<path stroke-linecap="round" d="M13 14c1.5-1 1.5-3 0-4" />
					<path
						d="M16 16C18.0858253 13.9141747 18.0858253 10.0858253 16 8M18 19C21.98552 15.01448 22.0076803 9.00768033 18 5"
					/>
				</svg>
			</button>
		{/each}
	</div>
	<div class="flex flex-col gap-3 mt-2">
		{#if !timelineState.selectedClip}
			<div class="text-sm font-medium">
				<span>Aspect ratio</span>

				<ToggleGroup.Root type="multiple" class="flex justify-end gap-x-2 mt-2">
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
			</div>
		{/if}

		{#if timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}

			<div class="text-sm font-medium">
				<span>Size</span>
				<div class="mt-2">
					<input
						type="number"
						class="bg-zinc-800 w-12 text-right px-1 py-0.5 rounded-sm ml-2 [&::-webkit-inner-spin-button]:appearance-none"
						onfocus={() => {
							appState.disableKeyboardShortcuts = true;
						}}
						onblur={() => {
							appState.disableKeyboardShortcuts = false;
							if (!clip.scaleX) clip.scaleX = 0;
						}}
						step=".01"
						bind:value={clip.scaleX}
					/><input
						type="number"
						class="bg-zinc-800 w-12 text-right px-1 py-0.5 rounded-sm ml-2 [&::-webkit-inner-spin-button]:appearance-none"
						onfocus={() => {
							appState.disableKeyboardShortcuts = true;
						}}
						onblur={() => {
							appState.disableKeyboardShortcuts = false;
							if (!clip.scaleY) clip.scaleY = 0;
						}}
						bind:value={clip.scaleY}
					/>
				</div>
			</div>
			<div class="text-sm font-medium mt-2">
				<span>Position</span>
				<div class="mt-2">
					<input
						type="number"
						class="bg-zinc-800 w-12 text-right px-1 py-0.5 rounded-sm ml-2 [&::-webkit-inner-spin-button]:appearance-none"
						onfocus={() => {
							appState.disableKeyboardShortcuts = true;
						}}
						onblur={() => {
							appState.disableKeyboardShortcuts = false;
							if (!clip.positionX) clip.positionX = 0;
						}}
						bind:value={clip.positionX}
					/><input
						type="number"
						class="bg-zinc-800 w-12 text-right px-1 py-0.5 rounded-sm ml-2 [&::-webkit-inner-spin-button]:appearance-none"
						onfocus={() => {
							appState.disableKeyboardShortcuts = true;
						}}
						onblur={() => {
							appState.disableKeyboardShortcuts = false;
							if (!clip.positionY) clip.positionY = 0;
						}}
						bind:value={clip.positionY}
					/>
				</div>
			</div>

			<!-- <div class="flex flex-col gap-3 mt-4">
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
			</div> -->
		{/if}
	</div>
</div>
