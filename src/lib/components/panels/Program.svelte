<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { setupWorker, updateWorkerClip } from '$lib/worker/actions.svelte';
	import type { Clip } from '$lib/clip/clip.svelte';

	import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
	import UndoIcon from '../icons/UndoIcon.svelte';

	let { mouseMove = $bindable(), mouseUp = $bindable() } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let canvasContainer = $state<HTMLDivElement>();

	let width = $state(0);
	let height = $state(0);
	let scale = $derived.by(() => {
		const widthScale = (width / 1920) * 90;
		const heightScale = (height / 1080) * 90;
		return heightScale < widthScale ? heightScale : widthScale;
	});

	let dragging = false;
	let resizing = false;
	let cornerHover = false;
	let cornerHoverStyle = 'nwse-resize';
	let draggedOffset = { x: 0, y: 0 };
	let mouseDownPosition = { x: 0, y: 0 };
	let savedClipPosition = { x: 0, y: 0 };
	let initialDistance = 0;
	let savedClipScale = { x: 0, y: 0 };
	let savedClipCenter = { x: 0, y: 0 };

	mouseMove = (e: MouseEvent) => {
		if (cornerHover) {
			if (canvasContainer) canvasContainer.style.cursor = cornerHoverStyle;
		} else {
			if (canvasContainer) canvasContainer.style.cursor = 'default';
		}

		if (appState.mouseMoveOwner !== 'program' || (!dragging && !resizing)) return;
		if (e.buttons < 1 || !timelineState.selectedClip) return;
		e.preventDefault();

		if (dragging) {
			draggedOffset.x = e.clientX - mouseDownPosition.x;
			draggedOffset.y = e.clientY - mouseDownPosition.y;
			const newX = savedClipPosition.x + (draggedOffset.x / (scale / 100) / 1920) * 2;
			timelineState.selectedClip.params[2] = Math.round(newX * 100) / 100;
			const newY = savedClipPosition.y - (draggedOffset.y / (scale / 100) / 1080) * 2;
			timelineState.selectedClip.params[3] = Math.round(newY * 100) / 100;

			updateWorkerClip(timelineState.selectedClip);
		}
		if (resizing) {
			if (!canvasContainer) return;
			const offsetX = e.clientX - canvasContainer.offsetLeft;
			const currentDistance = Math.sqrt(
				Math.pow(offsetX - savedClipCenter.x, 2) + Math.pow(e.clientY - savedClipCenter.y, 2)
			);
			const newScale = currentDistance / initialDistance;
			timelineState.selectedClip.params[0] = Math.round(savedClipScale.x * newScale * 100) / 100;
			timelineState.selectedClip.params[1] = Math.round(savedClipScale.y * newScale * 100) / 100;
			updateWorkerClip(timelineState.selectedClip);
			if (canvasContainer) canvasContainer.style.cursor = cornerHoverStyle;
		}
	};

	mouseUp = (e: MouseEvent) => {
		if (appState.mouseMoveOwner !== 'program') return;
		appState.disableHoverStates = false;
		appState.mouseMoveOwner = 'timeline';

		if (dragging) {
			dragging = false;
			const clip = timelineState.selectedClip;
			if (!clip) return;
			historyManager.pushAction({
				action: 'clipParam',
				data: {
					clipId: clip.id,
					paramIndex: [2, 3],
					oldValue: [savedClipPosition.x, savedClipPosition.y],
					newValue: [clip.params[2], clip.params[3]]
				}
			});
			historyManager.finishCommand();
		}
		if (resizing) {
			resizing = false;
			const clip = timelineState.selectedClip;
			if (!clip) return;
			historyManager.pushAction({
				action: 'clipParam',
				data: {
					clipId: clip.id,
					paramIndex: [0, 1],
					oldValue: [savedClipScale.x, savedClipScale.y],
					newValue: [clip.params[0], clip.params[1]]
				}
			});
			historyManager.finishCommand();
		}
	};

	const cornerMouseDown = (e: MouseEvent, clip: Clip, center: { x: number; y: number }) => {
		e.stopPropagation();
		e.preventDefault();
		appState.mouseMoveOwner = 'program';
		appState.disableHoverStates = true;
		resizing = true;

		savedClipCenter = center;
		savedClipScale = { x: clip.params[0], y: clip.params[1] };
		const offsetX = e.clientX - canvasContainer!.offsetLeft;
		initialDistance = Math.sqrt(
			Math.pow(offsetX - savedClipCenter.x, 2) + Math.pow(e.clientY - savedClipCenter.y, 2)
		);
	};

	let contextMenu: ContextMenu;
	const buttons = $state([
		{
			text: 'reset transform',
			icon: UndoIcon,
			onclick: () => {
				const clip = timelineState.selectedClip;
				if (!clip) return;
				historyManager.pushAction({
					action: 'clipParam',
					data: {
						clipId: clip.id,
						paramIndex: [0, 1, 2, 3],
						oldValue: [clip.params[0], clip.params[1], clip.params[2], clip.params[3]],
						newValue: [1, 1, 0, 0]
					}
				});
				clip.params[0] = 1;
				clip.params[1] = 1;
				clip.params[2] = 0;
				clip.params[3] = 0;
				updateWorkerClip(timelineState.selectedClip);
			},
			shortcuts: []
		}
	]);

	onMount(async () => {
		if (!canvas) return;
		setupWorker(canvas);
	});
</script>

<div
	class="h-full relative overflow-hidden"
	bind:this={canvasContainer}
	bind:clientHeight={height}
	bind:clientWidth={width}
>
	<div
		class="absolute"
		style:top={`${height / 2 - 540}px`}
		style:left={`${width / 2 - 960}px`}
		style:transform={`scale(${scale}%)`}
	>
		<canvas
			bind:this={canvas}
			width={1920}
			height={1080}
			oncontextmenu={(e) => {
				e.preventDefault();
			}}
		></canvas>
	</div>
	{#if timelineState.selectedClip && timelineState.selectedClip.source.type !== 'audio' && timelineState.currentFrame >= timelineState.selectedClip.start && timelineState.currentFrame < timelineState.selectedClip.start + timelineState.selectedClip.duration}
		{@const clip = timelineState.selectedClip}
		{@const boxSizeX = clip.params[0] * clip.source.width * (scale / 100)}
		{@const boxSizeY = clip.params[1] * clip.source.height * (scale / 100)}
		{@const offsetX = (clip.params[2] / 2) * 1920 * (scale / 100)}
		{@const offsetY = (clip.params[3] / 2) * 1080 * (scale / 100)}
		{@const top = height / 2 - boxSizeY / 2 - offsetY}
		{@const left = width / 2 - boxSizeX / 2 + offsetX}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_mouse_events_have_key_events -->
		<div
			style:top={`${top}px`}
			style:left={`${left}px`}
			style:width={`${boxSizeX}px`}
			style:height={`${boxSizeY}px`}
			class="border-2 border-white absolute top-0 left-0"
			onmousedown={(e) => {
				if (e.button > 0) return;
				e.preventDefault();
				dragging = true;
				savedClipPosition = { x: clip.params[2], y: clip.params[3] };
				mouseDownPosition = { x: e.clientX, y: e.clientY };
				appState.mouseMoveOwner = 'program';
				appState.disableHoverStates = true;
			}}
			oncontextmenu={(e) => {
				e.preventDefault();
				contextMenu.openContextMenu(e);
			}}
		>
			{@render cornerBox(0)}
			{@render cornerBox(1)}
			{@render cornerBox(2)}
			{@render cornerBox(3)}
			{#snippet cornerBox(corner: number)}
				<div
					onmouseenter={() => {
						cornerHover = true;
						cornerHoverStyle = corner === 0 || corner === 3 ? 'nwse-resize' : 'nesw-resize';
					}}
					onmouseleave={() => {
						cornerHover = false;
					}}
					onmousedown={(e) =>
						cornerMouseDown(e, clip, { x: left + boxSizeX / 2, y: top + boxSizeY / 2 })}
					class={[
						corner === 0 || corner === 2 ? '-top-[7px]' : '-bottom-[7px]',
						corner === 0 || corner === 1 ? '-left-[7px]' : '-bottom-[7px]',
						'h-[14px] w-[14px] border-2 rounded-[5px] border-white absolute -bottom-[7px] -right-[7px] bg-zinc-900'
					]}
				></div>
			{/snippet}
		</div>
	{/if}
</div>

<ContextMenu bind:this={contextMenu} {buttons} />
