<script lang="ts">
	import { appState } from '$lib/state.svelte';
	import { audioIcon, filmIcon, textIcon } from '../icons/Icons.svelte';

	let showIcon = $derived(appState.dragAndDrop.active && appState.dragAndDrop.showIcon);
	let startingCursor = { x: 0, y: 0 };
	let cursorMovedEnough = $state(false);

	const mouseMove = (e: MouseEvent) => {
		if (appState.dragAndDrop.clicked) {
			appState.dragAndDrop.currentCursor.x = e.clientX;
			appState.dragAndDrop.currentCursor.y = e.clientY;
			if (!cursorMovedEnough) {
				const distance = Math.sqrt(
					Math.pow(startingCursor.y - e.clientY, 2) + Math.pow(startingCursor.x - e.clientX, 2)
				);
				if (distance > 10) {
					cursorMovedEnough = true;
					appState.dragAndDrop.active = true;
					appState.dragAndDrop.showIcon = true;
				}
			}
		}
	};

	const mouseUp = () => {
		//appState.mouseIsDown = false;
		appState.dragAndDrop.clicked = false;
		if (appState.dragAndDrop.active) {
			appState.dragAndDrop.showIcon = false;
			cursorMovedEnough = false;

			// Wait for other mouseUp events before setting active to false
			setTimeout(() => {
				appState.dragAndDrop.active = false;
			}, 0);
		}
	};
</script>

{#if showIcon}
	{@const source = appState.dragAndDrop.source}
	<div
		style:background-image={`url(${source?.thumbnail})`}
		style:top={`${appState.dragAndDrop.currentCursor.y - 30}px`}
		style:left={`${appState.dragAndDrop.currentCursor.x - 44}px`}
		class={[
			source?.type === 'text' || source?.type === 'srt' ? 'bg-clip-purple-500' : '',
			source?.type === 'test' ? 'bg-clip-green-500' : '',
			source?.type === 'audio' ? 'bg-clip-blue-500' : '',
			source?.type === 'video' ? 'border-3 border-clip-green-500' : '',
			source?.type === 'image' ? 'border-3 border-clip-purple-500' : '',
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

<svelte:window onmousemove={mouseMove} onmouseup={mouseUp} />
