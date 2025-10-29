<script lang="ts">
	import { appState, audioState, timelineState } from '$lib/state.svelte';
	import { ToggleGroup, Tooltip } from 'bits-ui';
	import {
		speakerIcon,
		audioIcon,
		textIcon,
		moveIcon,
		justifyCenterIcon,
		justifyLeftIcon,
		justifyRightIcon
	} from '../icons/Icons.svelte';

	import Slider from '../ui/Slider.svelte';
	import MyTooltip from '../ui/Tooltip.svelte';
	import Settings from '../ui/settings';

	type Section = 'masterAudio' | 'project' | 'layout' | 'audio' | 'text';
	let previousSelected: Section;
	let selected: Section = $derived.by<Section>(() => {
		if (timelineState.selectedClip) {
			const type = timelineState.selectedClip.source.type;
			if (type === 'audio') {
				return 'audio';
			}
			if (type === 'text') {
				return 'text';
			}
			if ((type === 'video' || type === 'test') && previousSelected === 'audio') return 'audio';
			previousSelected = 'layout';
			return 'layout';
		} else {
			previousSelected = 'masterAudio';
			return 'masterAudio';
		}
	});
</script>

<!-- <Tooltip.Provider> -->
<div class="flex mt-12 mr-16 xl:mr-[calc(100svw/20)] rounded text-zinc-500 text-right relative">
	<div class="absolute -right-13">
		<div class=" bg-zinc-950 rounded flex flex-col mb-5">
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<!-- 	<MyTooltip
					contentProps={{ side: 'left' }}
					triggerProps={{ onclick: () => (selected = 'masterAudio') }}
				>
					{#snippet trigger()} -->
			<button
				onclick={() => (selected = 'masterAudio')}
				class={[
					selected === 'masterAudio' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
					'p-2'
				]}
			>
				{@render speakerIcon('w-6 h-6')}
			</button>
			<!-- 	{/snippet}
					output audio
				</MyTooltip> -->
			<!-- <button
				onclick={() => (selected = 'project')}
				class={[
					selected === 'project' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
					'p-2'
				]}
			>
				<SettingsIcon class="w-6 h-6" />
			</button> -->
		</div>
		{#if timelineState.selectedClip}
			{@const source = timelineState.selectedClip.source}
			<div class=" bg-zinc-950 rounded flex flex-col">
				{#if source.type !== 'audio'}
					<!-- 	<MyTooltip
							contentProps={{ side: 'left' }}
							triggerProps={{ onclick: () => (selected = 'layout') }}
						>
							{#snippet trigger()} -->
					<button
						onclick={() => {
							selected = 'layout';
							previousSelected = 'layout';
						}}
						class={[
							selected === 'layout' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
							'p-2'
						]}
					>
						{@render moveIcon('w-6 h-6')}
						<!-- <MoveIcon class="w-6 h-6" /> -->
					</button>
					<!-- 	{/snippet}
							clip transform
						</MyTooltip> -->
				{/if}
				{#if source.type === 'text'}
					<!-- <MyTooltip
							contentProps={{ side: 'left' }}
							triggerProps={{ onclick: () => (selected = 'text') }}
						>
							{#snippet trigger()} -->
					<button
						onclick={() => {
							selected = 'text';
							previousSelected = 'text';
						}}
						class={[
							selected === 'text' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
							'p-2'
						]}
					>
						{@render textIcon('w-6 h-6')}
					</button>
					<!--	{/snippet}
							 clip text
						</MyTooltip> -->
				{/if}
				{#if source.type !== 'text'}
					<!-- 		<MyTooltip
							contentProps={{ side: 'left' }}
							triggerProps={{ onclick: () => (selected = 'audio') }}
						>
							{#snippet trigger()} -->
					<button
						onclick={() => {
							selected = 'audio';
							previousSelected = 'audio';
						}}
						class={[
							selected === 'audio' ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
							'p-2'
						]}
					>
						{@render audioIcon('w-6 h-6')}
					</button>
					<!-- {/snippet}
							clip audio
						</MyTooltip> -->
				{/if}
			</div>
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

		{#if selected === 'layout' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Settings.Group label={'size'}>
				<Settings.Input bind:value={clip.params[0]} fallback={1} />
				<Settings.Input bind:value={clip.params[1]} fallback={1} />
			</Settings.Group>
			<Settings.Group label={'position'}>
				<Settings.Input bind:value={clip.params[2]} />
				<Settings.Input bind:value={clip.params[3]} />
			</Settings.Group>
		{/if}
		{#if selected === 'text' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Settings.Group label={'text'}>
				<Settings.Textarea bind:value={clip.text} />
			</Settings.Group>
			<Settings.Group label={'font size'}>
				<Settings.Input bind:value={clip.params[6]} fallback={20} />
			</Settings.Group>
			<Settings.Group label={'justify'}>
				<!-- <Settings.Input bind:value={clip.params[8]} fallback={0} /> -->
				<Settings.Toggle
					bind:value={clip.params[8]}
					items={[
						{ value: 0, icon: justifyLeftIcon },
						{ value: 1, icon: justifyCenterIcon },
						{ value: 2, icon: justifyRightIcon }
					]}
				/>
			</Settings.Group>
			<Settings.Group label={'line height'}>
				<Settings.Input bind:value={clip.params[7]} fallback={0} />
			</Settings.Group>
		{/if}
		{#if selected === 'audio' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Settings.Group label={'gain'}>
				<Settings.Input bind:value={clip.params[4]} fallback={1} />
			</Settings.Group>
			<Settings.Group label={'pan'}>
				<Settings.Input bind:value={clip.params[5]} fallback={0} />
			</Settings.Group>
		{/if}
		{#if selected === 'masterAudio'}
			<div class="flex h-full w-full justify-end pr-3">
				<Slider
					bind:value={audioState.masterGain}
					onValueChange={(g: number) => {
						audioState.masterGainNode.gain.value = g;
					}}
				/>
			</div>
		{/if}
	</div>

	{#if selected === 'masterAudio'}
		<div
			class="flex-none w-3.5 h-68 flex justify-between bg-zinc-950"
			style="background:linear-gradient(90deg,#090909 43%, #18181b 43%, #18181b 57%,#090909 57%);"
		>
			<div
				class="w-1.5 h-full"
				style="background:linear-gradient(0deg,rgba(34, 138, 106, 1) 0%, rgba(34, 138, 106, 1) 70%, rgba(80, 207, 175, 1) 70%);"
				style:clip-path={`rect(${(1 - appState.audioLevel[0]) * 100}% 100% 100% 0%)`}
			></div>
			<div
				class="w-1.5 h-full"
				style="background:linear-gradient(0deg,rgba(34, 138, 106, 1) 0%, rgba(34, 138, 106, 1) 70%, rgba(80, 207, 175, 1) 70%);"
				style:clip-path={`rect(${(1 - appState.audioLevel[1]) * 100}% 100% 100% 0%)`}
			></div>
		</div>
	{/if}
</div>
<!-- </Tooltip.Provider> -->
