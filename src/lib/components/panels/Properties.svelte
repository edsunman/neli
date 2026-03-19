<script lang="ts">
	import { appState, audioState, projectManager, timelineState } from '$lib/state.svelte';
	import {
		speakerIcon,
		audioIcon,
		textIcon,
		moveIcon,
		justifyCenterIcon,
		justifyLeftIcon,
		justifyRightIcon,
		filmIcon,
		fileIcon,
		aspectLandscape,
		aspectSquare,
		aspectPortrait,
		imageIcon,
		opacityIcon,
		cropIcon
	} from '../icons/Icons.svelte';
	import { changeProjectResolution } from '$lib/project/actions';
	import { secondsToTimecode } from '$lib/timeline/utils';
	import { Tooltip as BitsTooltip } from 'bits-ui';
	import type { PropertiesSection } from '$lib/types';
	import type { Snippet } from 'svelte';

	import Slider from '../ui/Slider.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	import Properties from '../ui/Properties';
</script>

<div class="flex mt-5 height-lg:mt-12 mr-16 xl:mr-[calc(100svw/20)] rounded text-zinc-500 relative">
	<div class="absolute -right-13 z-10">
		<BitsTooltip.Provider delayDuration={500}>
			<div class=" bg-zinc-950 rounded-lg flex flex-col mb-5">
				{@render sideButton('project', 'project settings', fileIcon)}
			</div>
			<div class=" bg-zinc-950 rounded-lg flex flex-col mb-5">
				{@render sideButton('outputAudio', 'output audio', speakerIcon)}
			</div>
			{#if appState.selectedSource}
				<div class="bg-zinc-950 rounded-lg flex flex-col">
					{#if appState.selectedSource.type === 'video'}
						{@render sideButton('source', 'source details', filmIcon)}
					{:else if appState.selectedSource.type === 'audio'}
						{@render sideButton('source', 'source details', audioIcon)}
					{:else if appState.selectedSource.type === 'image'}
						{@render sideButton('source', 'source details', imageIcon)}
					{/if}
				</div>
			{/if}
			{#if timelineState.selectedClip && !timelineState.selectedClip.temp}
				{@const source = timelineState.selectedClip.source}
				<div class="bg-zinc-950 rounded-lg flex flex-col">
					{#if source.type !== 'audio'}
						{@render sideButton('layout', 'layout settings', moveIcon)}
					{/if}
					{#if source.type === 'text'}
						{@render sideButton('text', 'text settings', textIcon)}
					{/if}
					{#if source.type === 'video' || source.type === 'test' || source.type === 'image'}
						{@render sideButton('crop', 'crop settings', cropIcon)}
						{@render sideButton('colour', 'colour settings', opacityIcon)}
					{/if}
					{#if source.type === 'audio' || source.type === 'video' || source.type === 'test'}
						{@render sideButton('audio', 'audio settings', audioIcon)}
					{/if}
				</div>
			{/if}
		</BitsTooltip.Provider>
	</div>

	<div class="flex-1 flex flex-col gap-5 height-xl:gap-6 mt-2 mr-3">
		{#if appState.propertiesSection === 'project'}
			<Properties.Group label="project name">
				<Properties.Input
					bind:value={appState.project.name}
					type="text"
					fullWidth
					fallback="untitled"
					onBlur={() => {
						projectManager.updateProject({ name: appState.project.name });
					}}
				/>
			</Properties.Group>
			<Properties.Group label="aspect ratio">
				<Properties.Toggle
					bind:value={appState.project.aspect}
					updateWorker={false}
					items={[
						{
							value: 0,
							icon: aspectLandscape,
							onClick: () => {
								changeProjectResolution(1920, 1080);
								projectManager.updateProject({ aspect: 0 });
							}
						},
						{
							value: 1,
							icon: aspectSquare,
							onClick: () => {
								changeProjectResolution(1080, 1080);
								projectManager.updateProject({ aspect: 1 });
							}
						},
						{
							value: 2,
							icon: aspectPortrait,
							onClick: () => {
								changeProjectResolution(1080, 1920);
								projectManager.updateProject({ aspect: 2 });
							}
						}
					]}
				/>
			</Properties.Group>
			<Properties.Group label="resolution">
				<span class="text-zinc-300">
					{appState.project.resolution.height} x {appState.project.resolution.width}
				</span>
			</Properties.Group>
			<Properties.Group label="frame rate">
				<span class="text-zinc-300">30 fps</span>
			</Properties.Group>
		{/if}

		{#if appState.propertiesSection === 'source' && appState.selectedSource}
			{@const source = appState.selectedSource}
			<Properties.Group label="name">
				<Properties.Input bind:value={source.name} type="text" fullWidth fallback="_" />
			</Properties.Group>
			{#if source.info.type === 'video'}
				<Properties.Group label="duration">
					<span class="text-zinc-300">{secondsToTimecode(source.info.duration)}</span>
				</Properties.Group>
				<Properties.Group label="resolution">
					<span class="text-zinc-300">
						{source.info.resolution.height} x {source.info.resolution.width}
					</span>
				</Properties.Group>
				<Properties.Group label="frame rate">
					<span class="text-zinc-300">{Math.round(source.info.frameRate * 100) / 100} fps</span>
				</Properties.Group>
			{/if}
			{#if source.info.type === 'audio'}
				<Properties.Group label="duration">
					<span class="text-zinc-300">{secondsToTimecode(source.info.duration)}</span>
				</Properties.Group>
				<Properties.Group label="sampleRate">
					<span class="text-zinc-300">{source.info.sampleRate / 1000} kHz</span>
				</Properties.Group>
				<Properties.Group label="channels">
					<span class="text-zinc-300">{source.info.channelCount}</span>
				</Properties.Group>
			{/if}
			{#if source.info.type === 'image'}
				<Properties.Group label="resolution">
					<span class="text-zinc-300">
						{source.info.resolution.height} x {source.info.resolution.width}
					</span>
				</Properties.Group>
				<Properties.Group label="format">
					<span class="text-zinc-300">{source.info.format}</span>
				</Properties.Group>
			{/if}
		{/if}

		{#if appState.propertiesSection === 'layout' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			{#if clip.source.type !== 'text'}
				<input bind:value={clip.params[1]} />
				<Properties.Group label="size">
					<Properties.Input bind:value={clip.params[0]} fallback={1} />
					<Properties.Input bind:value={clip.params[1]} fallback={1} />
				</Properties.Group>
			{/if}
			<Properties.Group label="position">
				<Properties.Input bind:value={clip.params[2]} />
				<Properties.Input bind:value={clip.params[3]} />
			</Properties.Group>
			<Properties.Group label="rotate">
				<Properties.Input bind:value={clip.params[17]} />
			</Properties.Group>
		{/if}
		{#if appState.propertiesSection === 'text' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Properties.Group label="text">
				<Properties.Textarea bind:value={clip.text} />
			</Properties.Group>
			<Properties.Group label="font size">
				<Properties.Input bind:value={clip.params[6]} fallback={20} />
			</Properties.Group>
			<Properties.Group label="justify">
				<Properties.Toggle
					bind:value={clip.params[8]}
					items={[
						{ value: 0, icon: justifyLeftIcon },
						{ value: 1, icon: justifyCenterIcon },
						{ value: 2, icon: justifyRightIcon }
					]}
				/>
			</Properties.Group>
			<Properties.Group label="line spacing">
				<Properties.Input bind:value={clip.params[7]} fallback={1} />
			</Properties.Group>
		{/if}
		{#if appState.propertiesSection === 'crop' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Properties.Group label="crop" className={['w-30']}>
				<Properties.Input bind:value={clip.params[12]} />
				<Properties.Input bind:value={clip.params[13]} />
				<Properties.Input bind:value={clip.params[14]} />
				<Properties.Input bind:value={clip.params[15]} />
			</Properties.Group>
			<Properties.Group label="round corners">
				<Properties.Input bind:value={clip.params[16]} />
			</Properties.Group>
		{/if}
		{#if appState.propertiesSection === 'colour' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Properties.Group label="opacity">
				<Properties.Input bind:value={clip.params[18]} fallback={1} />
			</Properties.Group>
			<Properties.Group label="exposure">
				<Properties.Input bind:value={clip.params[19]} fallback={0} />
			</Properties.Group>
			<Properties.Group label="contrast">
				<Properties.Input bind:value={clip.params[20]} fallback={0} />
			</Properties.Group>
			<Properties.Group label="saturation">
				<Properties.Input bind:value={clip.params[21]} fallback={0} />
			</Properties.Group>
		{/if}
		{#if appState.propertiesSection === 'audio' && timelineState.selectedClip}
			{@const clip = timelineState.selectedClip}
			<Properties.Group label="gain">
				<Properties.Input bind:value={clip.params[4]} fallback={1} />
			</Properties.Group>
			<Properties.Group label="pan">
				<Properties.Input bind:value={clip.params[5]} fallback={0} />
			</Properties.Group>
		{/if}

		{#if appState.propertiesSection === 'outputAudio'}
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

	{#if appState.propertiesSection === 'outputAudio'}
		<div
			class="flex-none w-3.5 h-68 flex justify-between bg-zinc-950"
			style="background:linear-gradient(90deg,#090909 43%, #18181b 43%, #18181b 57%,#090909 57%);"
		>
			<div
				class="w-1.5 h-full"
				style="background:linear-gradient(0deg,rgba(34, 138, 106, 1) 0%, rgba(34, 138, 106, 1) 70%, rgba(80, 207, 175, 1) 70%);"
				style:clip-path={`rect(${(1 - audioState.audioLevel[0]) * 100}% 100% 100% 0%)`}
			></div>
			<div
				class="w-1.5 h-full"
				style="background:linear-gradient(0deg,rgba(34, 138, 106, 1) 0%, rgba(34, 138, 106, 1) 70%, rgba(80, 207, 175, 1) 70%);"
				style:clip-path={`rect(${(1 - audioState.audioLevel[1]) * 100}% 100% 100% 0%)`}
			></div>
		</div>
	{/if}
</div>

{#snippet sideButton(section: PropertiesSection, description: string, icon: Snippet<[string]>)}
	<Tooltip
		contentProps={{ side: 'left' }}
		triggerProps={{ onclick: () => (appState.propertiesSection = section) }}
	>
		{#snippet trigger()}
			<div
				class={[
					appState.propertiesSection === section
						? 'text-zinc-200'
						: 'text-zinc-600 hover:text-zinc-400',
					'p-2'
				]}
			>
				{@render icon('w-6 h-6')}
			</div>
		{/snippet}
		{description}
	</Tooltip>
{/snippet}
