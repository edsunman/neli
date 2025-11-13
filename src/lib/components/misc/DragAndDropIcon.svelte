<script lang="ts">
	import { appState } from '$lib/state.svelte';

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
			'h-[60px] w-[88px] flex flex-wrap justify-center content-center top-2 left-2 absolute',
			'rounded-lg pointer-events-none  transition-opacity bg-cover bg-center'
		]}
	></div>
{/if}
