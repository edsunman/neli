<script lang="ts">
	import { appState, timelineState } from '$lib/state.svelte';
	import { Slider, ToggleGroup } from 'bits-ui';
	import SpeakerIcon from '../icons/SpeakerIcon.svelte';
	import SettingsIcon from '../icons/SettingsIcon.svelte';
	import AudioIcon from '../icons/AudioIcon.svelte';
	import SettingsInput from '../ui/SettingsInput.svelte';
	import SettingsGroup from '../ui/SettingsGroup.svelte';

	let selected = $state<'audio' | 'project' | 'clip'>('audio');

	$effect(() => {
		if (timelineState.selectedClip) {
			selected = 'clip';
		} else {
			selected = 'audio';
		}
	});
</script>

<div class="flex mt-12 mr-[calc(100svw/20)] rounded text-zinc-500 text-right relative">
	<div class="absolute -right-13 flex flex-col bg-[#131315] rounded">
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button
			onclick={() => (selected = 'audio')}
			class={[selected === 'audio' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400', 'p-2']}
		>
			<SpeakerIcon class="w-6 h-6" />
		</button>
		<button
			onclick={() => (selected = 'project')}
			class={[
				selected === 'project' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
				'p-2'
			]}
		>
			<SettingsIcon class="w-6 h-6" />
		</button>
		{#if timelineState.selectedClip}
			<button
				onclick={() => (selected = 'clip')}
				class={[selected === 'clip' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400', 'p-2']}
			>
				<AudioIcon class="w-6 h-6" />
			</button>
		{/if}
	</div>

	<div class="flex-1 flex flex-col gap-3 mt-2 mr-3">
		{#if selected === 'project'}
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

		{#if selected === 'clip' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<SettingsGroup label={'size'}>
				<SettingsInput bind:value={clip.params[0]} fallback={1} />
				<SettingsInput bind:value={clip.params[1]} fallback={1} />
			</SettingsGroup>
			<SettingsGroup label={'position'}>
				<SettingsInput bind:value={clip.params[2]} />
				<SettingsInput bind:value={clip.params[3]} />
			</SettingsGroup>
			<SettingsGroup label={'text'}>
				<SettingsInput bind:value={clip.text} type="text" fallback={'_'} />
			</SettingsGroup>

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
	{#if selected === 'audio'}
		<div
			class="flex-none w-3.5 h-68 flex justify-between bg-zinc-950"
			style="background:linear-gradient(90deg,#090909 43%, #18181b 43%, #18181b 57%,#090909 57%);"
		>
			<div
				class="w-1.5 h-full"
				style="background:linear-gradient(0deg,rgba(81, 81, 81, 1) 0%, rgba(120, 120, 120, 1) 70%, rgba(178, 178, 178, 1) 70%);"
				style:clip-path={`rect(${(1 - appState.audioLevel[0]) * 100}% 100% 100% 0%)`}
			></div>
			<div
				class="w-1.5 h-full"
				style="background:linear-gradient(0deg,rgba(81, 81, 81, 1) 0%, rgba(120, 120, 120, 1) 70%, rgba(178, 178, 178, 1) 70%);"
				style:clip-path={`rect(${(1 - appState.audioLevel[1]) * 100}% 100% 100% 0%)`}
			></div>
		</div>
	{/if}
</div>
