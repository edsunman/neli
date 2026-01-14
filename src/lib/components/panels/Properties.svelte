<script lang="ts">
	import { appState, audioState, timelineState } from '$lib/state.svelte';
	import {
		speakerIcon,
		audioIcon,
		textIcon,
		moveIcon,
		justifyCenterIcon,
		justifyLeftIcon,
		justifyRightIcon,
		settingsIcon,
		filmIcon
	} from '../icons/Icons.svelte';

	import Slider from '../ui/Slider.svelte';
	import MyTooltip from '../ui/Tooltip.svelte';
	import Properties from '../ui/Properties';

	/* type Section = 'masterAudio' | 'project' | 'layout' | 'audio' | 'text' | 'source';
	let previousSelected: Section;
	let selected: Section = $derived.by<Section>(() => {
		timelineState.playing;
		if (timelineState.selectedClip && !timelineState.selectedClip.temp) {
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
	}); */
</script>

<!-- <Tooltip.Provider> -->
<div
	class="flex mt-5 height-lg:mt-12 mr-16 xl:mr-[calc(100svw/20)] rounded text-zinc-500 text-right relative"
>
	<div class="absolute -right-13">
		<div class=" bg-zinc-950 rounded flex flex-col mb-5">
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<!-- 	<MyTooltip
					contentProps={{ side: 'left' }}
					triggerProps={{ onclick: () => (selected = 'masterAudio') }}
				>
					{#snippet trigger()} -->
			<button
				onclick={() => (appState.propertiesSection = 'project')}
				class={[
					appState.propertiesSection === 'project'
						? 'text-zinc-200'
						: 'text-zinc-600 hover:text-zinc-400',
					'p-2'
				]}
			>
				{@render settingsIcon('w-6 h-6')}
			</button>
			<button
				onclick={() => (appState.propertiesSection = 'masterAudio')}
				class={[
					appState.propertiesSection === 'masterAudio'
						? 'text-zinc-200'
						: 'text-zinc-600 hover:text-zinc-400',
					'p-2'
				]}
			>
				{@render speakerIcon('w-6 h-6')}
			</button>
			<!-- 	{/snippet}
					output audio
				</MyTooltip> -->
		</div>
		{#if appState.selectedSource}
			<div class="bg-zinc-950 rounded flex flex-col">
				<button
					onclick={() => {
						appState.propertiesSection = 'source';
						//previousSelected = 'source';
					}}
					class={[
						appState.propertiesSection === 'source'
							? 'text-zinc-200'
							: 'text-zinc-600 hover:text-zinc-400',
						'p-2'
					]}
				>
					{@render filmIcon('w-6 h-6')}
					<!-- <MoveIcon class="w-6 h-6" /> -->
				</button>
			</div>
		{/if}
		{#if timelineState.selectedClip && !timelineState.selectedClip.temp}
			{@const source = timelineState.selectedClip.source}
			<div class="bg-zinc-950 rounded flex flex-col">
				{#if source.type !== 'audio'}
					<!-- 	<MyTooltip
							contentProps={{ side: 'left' }}
							triggerProps={{ onclick: () => (selected = 'layout') }}
						>
							{#snippet trigger()} -->
					<button
						onclick={() => {
							appState.propertiesSection = 'layout';
							//previousSelected = 'layout';
						}}
						class={[
							appState.propertiesSection === 'layout'
								? 'text-zinc-200'
								: 'text-zinc-600 hover:text-zinc-400',
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
							appState.propertiesSection = 'text';
							//previousSelected = 'text';
						}}
						class={[
							appState.propertiesSection === 'text'
								? 'text-zinc-200'
								: 'text-zinc-600 hover:text-zinc-400',
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
							appState.propertiesSection = 'audio';
							// previousSelected = 'audio';
						}}
						class={[
							appState.propertiesSection === 'audio'
								? 'text-zinc-200'
								: 'text-zinc-600 hover:text-zinc-400',
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
		{#if appState.propertiesSection === 'project'}
			<div class="text-sm font-medium">
				<Properties.Group label={'aspect ratio'}>
					<!-- <Properties.Input bind:value={clip.params[8]} fallback={0} /> -->
					<Properties.Toggle
						items={[
							{ value: 0, icon: justifyLeftIcon },
							{ value: 1, icon: justifyCenterIcon },
							{ value: 2, icon: justifyRightIcon }
						]}
					/>
				</Properties.Group>
				<!-- <span>Aspect ratio</span>
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
				</ToggleGroup.Root> -->
			</div>
		{/if}

		{#if appState.propertiesSection === 'source' && appState.selectedSource}
			{@const source = appState.selectedSource}
			<Properties.Group label={'name'}>
				{source.name}
			</Properties.Group>
		{/if}

		{#if appState.propertiesSection === 'layout' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			{#if clip.source.type !== 'text'}
				<Properties.Group label={'size'}>
					<Properties.Input bind:value={clip.params[0]} fallback={1} />
					<Properties.Input bind:value={clip.params[1]} fallback={1} />
				</Properties.Group>
			{/if}
			<Properties.Group label={'position'}>
				<Properties.Input bind:value={clip.params[2]} />
				<Properties.Input bind:value={clip.params[3]} />
			</Properties.Group>
		{/if}
		{#if appState.propertiesSection === 'text' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Properties.Group label={'text'}>
				<Properties.Textarea bind:value={clip.text} />
			</Properties.Group>
			<Properties.Group label={'font size'}>
				<Properties.Input bind:value={clip.params[6]} fallback={20} />
			</Properties.Group>
			<Properties.Group label={'justify'}>
				<!-- <Properties.Input bind:value={clip.params[8]} fallback={0} /> -->
				<Properties.Toggle
					bind:value={clip.params[8]}
					items={[
						{ value: 0, icon: justifyLeftIcon },
						{ value: 1, icon: justifyCenterIcon },
						{ value: 2, icon: justifyRightIcon }
					]}
				/>
			</Properties.Group>
			<Properties.Group label={'line spacing'}>
				<Properties.Input bind:value={clip.params[7]} fallback={1} />
			</Properties.Group>
		{/if}
		{#if appState.propertiesSection === 'audio' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Properties.Group label={'gain'}>
				<Properties.Input bind:value={clip.params[4]} fallback={1} />
			</Properties.Group>
			<Properties.Group label={'pan'}>
				<Properties.Input bind:value={clip.params[5]} fallback={0} />
			</Properties.Group>
		{/if}
		{#if appState.propertiesSection === 'masterAudio'}
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

	{#if appState.propertiesSection === 'masterAudio'}
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
