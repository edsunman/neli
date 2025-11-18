<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { audioIcon, filmIcon, textIcon } from '../icons/Icons.svelte';

	let showIcon = $derived(appState.dragAndDrop.active && appState.dragAndDrop.showIcon);
</script>

{#if showIcon}
	{@const source = appState.dragAndDrop.source}
	<div
		style:background-image={`url(${source?.thumbnail})`}
		style:top={`${appState.dragAndDrop.y - 30}px`}
		style:left={`${appState.dragAndDrop.x - 44}px`}
		class={[
			source?.type === 'text' || source?.type === 'srt' ? 'bg-clip-purple-500' : '',
			source?.type === 'test' ? 'bg-clip-green-500' : '',
			source?.type === 'audio' ? 'bg-clip-blue-500' : '',
			source?.type === 'video' ? 'border-3 border-clip-green-500' : '',
			'h-[60px] w-[88px] flex flex-wrap justify-center content-center top-2 left-2 absolute',
			'rounded-lg pointer-events-none  transition-opacity bg-cover bg-center z-100'
		]}
	>
		{#if source?.type === 'text'}
			{@render textIcon('w-8 h-8 text-clip-purple-600')}
		{:else if source?.type === 'srt'}
			<span class="text-clip-purple-600 text-2xl font-extrabold">.srt</span>
		{:else if source?.type === 'test'}
			{@render filmIcon('w-8 h-8 text-clip-green-600')}
		{:else if source?.type === 'audio'}
			{@render audioIcon('w-8 h-8 text-clip-blue-600')}
		{/if}
	</div>
{/if}
