<script lang="ts">
	import type { Clip } from '$lib/clip/clip.svelte';
	import { getClipFillScaleFactor, getClipFitScaleFactor } from '$lib/clip/utils';

	import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
	import { transformClip } from '$lib/program/actions';
	import { appState, historyManager, programState, timelineState } from '$lib/state.svelte';
	import { measureText } from '$lib/text/utils';
	import { updateWorkerClip } from '$lib/worker/actions.svelte';

	type Props = {
		clip: Clip;
		canvasContainer: HTMLDivElement;
	};
	let { clip, canvasContainer }: Props = $props();

	let contextMenu: ContextMenu;
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

	let scale = $derived.by(() => {
		const widthScale = (canvasContainer.clientWidth / programState.canvasWidth) * 90;
		const heightScale = (canvasContainer.clientHeight / programState.canvasHeight) * 90;
		return heightScale < widthScale ? heightScale : widthScale;
	});
	let boxSizeX = $derived.by(() => {
		if (clip.source.info.type === 'test') return clip.params[0] * 1920 * (scale / 100);
		if (clip.source.info.type !== 'video' && clip.source.info.type !== 'image') return 0;
		return clip.params[0] * clip.source.info.resolution.width * (scale / 100);
	});
	let boxSizeY = $derived.by(() => {
		if (clip.source.info.type === 'test') return clip.params[1] * 1080 * (scale / 100);
		if (clip.source.info.type !== 'video' && clip.source.info.type !== 'image') return 0;
		return clip.params[1] * clip.source.info.resolution.height * (scale / 100);
	});
	let position = $derived({
		top:
			canvasContainer.clientHeight / 2 -
			boxSizeY / 2 -
			(clip.params[3] / 2) * programState.canvasHeight * (scale / 100),
		left:
			canvasContainer.clientWidth / 2 -
			boxSizeX / 2 +
			(clip.params[2] / 2) * programState.canvasWidth * (scale / 100)
	});

	const mouseMove = (e: MouseEvent) => {
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
			const newX =
				savedClipPosition.x + (draggedOffset.x / (scale / 100) / programState.canvasWidth) * 2;
			timelineState.selectedClip.params[2] = Math.round(newX * 100) / 100;
			const newY =
				savedClipPosition.y - (draggedOffset.y / (scale / 100) / programState.canvasHeight) * 2;
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

	const mouseUp = () => {
		if (appState.mouseMoveOwner !== 'program') return;
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
		appState.mouseIsDown = true;
		resizing = true;

		savedClipCenter = center;
		savedClipScale = { x: clip.params[0], y: clip.params[1] };
		const offsetX = e.clientX - canvasContainer!.offsetLeft;
		initialDistance = Math.sqrt(
			Math.pow(offsetX - savedClipCenter.x, 2) + Math.pow(e.clientY - savedClipCenter.y, 2)
		);
	};

	const getTextBoundingBox = (
		text: string,
		fontSize: number,
		scale: number,
		lineSpacing: number
	) => {
		if (text.length === 0) text = '_';
		const measurements = measureText(text, appState.fonts[0], lineSpacing);
		// scale factor based on font size, canvas scale and arbitrary number
		const scaleFactor = (scale / 100) * (fontSize / 9.3);
		const x = measurements.width * scaleFactor + 10;
		const y = measurements.height * scaleFactor + 10;
		return { x, y };
	};

	const buttons = $state([
		{
			text: 'scale to fit',
			onclick: () => {
				const clip = timelineState.selectedClip;
				if (!clip) return;
				const scaleFactor = getClipFitScaleFactor(clip);
				transformClip(clip, scaleFactor, scaleFactor, 0, 0);
			},
			shortcuts: []
		},
		{
			text: 'scale to fill',
			onclick: () => {
				const clip = timelineState.selectedClip;
				if (!clip) return;
				const scaleFactor = getClipFillScaleFactor(clip);
				transformClip(clip, scaleFactor, scaleFactor, 0, 0);
			},
			shortcuts: []
		}
	]);
</script>

{#if clip.source.type === 'video' || clip.source.type === 'test' || clip.source.type === 'image'}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_mouse_events_have_key_events -->
	<div
		style:top={`${position.top}px`}
		style:left={`${position.left}px`}
		style:width={`${boxSizeX}px`}
		style:height={`${boxSizeY}px`}
		class="border-2 border-white absolute top-0 left-0"
		onmousedown={(e) => {
			if (e.button > 0) return;
			e.preventDefault();
			e.stopPropagation();
			dragging = true;
			savedClipPosition = { x: clip.params[2], y: clip.params[3] };
			mouseDownPosition = { x: e.clientX, y: e.clientY };
			appState.mouseMoveOwner = 'program';
			appState.mouseIsDown = true;
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
					cornerMouseDown(e, clip, {
						x: position.left + boxSizeX / 2,
						y: position.top + boxSizeY / 2
					})}
				class={[
					corner === 0 || corner === 2 ? '-top-[7px]' : '-bottom-[7px]',
					corner === 0 || corner === 1 ? '-left-[7px]' : '-bottom-[7px]',
					'h-[14px] w-[14px] border-2 rounded-[5px] border-white absolute -bottom-[7px] -right-[7px] bg-zinc-900'
				]}
			></div>
		{/snippet}
	</div>
{/if}
{#if clip.source.type === 'text'}
	{@const { x, y } = getTextBoundingBox(clip.text, clip.params[6], scale, clip.params[7])}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		style:top={`${position.top + boxSizeY / 2 - y / 2}px`}
		style:left={`${position.left + boxSizeX / 2 - x / 2}px`}
		style:width={`${x}px`}
		style:height={`${y}px`}
		class="border-2 border-white absolute top-0 left-0"
		onmousedown={(e) => {
			if (e.button > 0) return;
			e.preventDefault();
			dragging = true;
			savedClipPosition = { x: clip.params[2], y: clip.params[3] };
			mouseDownPosition = { x: e.clientX, y: e.clientY };
			appState.mouseMoveOwner = 'program';
			appState.mouseIsDown = true;
		}}
		oncontextmenu={(e) => {
			e.preventDefault();
			contextMenu.openContextMenu(e);
		}}
	></div>
{/if}

<ContextMenu bind:this={contextMenu} {buttons} />
<svelte:window onmousemove={mouseMove} onmouseup={mouseUp} />
