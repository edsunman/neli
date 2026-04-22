<script lang="ts">
	import type { Clip } from '$lib/clip/clip.svelte';
	import { createOrUpdateKeyframe, finaliseKeyframe } from '$lib/clip/keyframes';
	import { getClipFillTransform, getClipFitTransform, roundTo } from '$lib/clip/utils';

	import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
	import { transformClip } from '$lib/program/actions';
	import {
		appState,
		historyManager,
		programState,
		projectManager,
		timelineState,
		workerManager
	} from '$lib/state.svelte';
	import { measureText } from '$lib/text/utils';
	import { scaleToFillIcon, scaleToFitIcon } from '../icons/Icons.svelte';

	type Props = {
		clip: Clip;
		canvasContainer: HTMLDivElement;
		scale: number;
		cropping: boolean;
		dragging: boolean;
	};
	let { clip, canvasContainer, scale, cropping = $bindable(), dragging }: Props = $props();

	let contextMenu: ContextMenu;
	let resizing = false;
	let cornerHover = false;
	let cornerHoverStyle = 'nwse-resize';
	let initialDistance = 0;
	let savedClipScale = { x: 0, y: 0 };
	let savedClipCenter = { x: 0, y: 0 };
	let initialPosition = 0;
	let savedClipCrop = 0;
	let currentEdge = 0;

	let boxSizeWidth = $derived.by(() => {
		if (clip.source.info.type === 'test') return clip.params[0] * 1920 * (scale / 100);
		if (clip.source.info.type !== 'video' && clip.source.info.type !== 'image') return 0;
		return clip.params[0] * clip.source.info.resolution.width * (scale / 100);
	});
	let boxSizeHeight = $derived.by(() => {
		if (clip.source.info.type === 'test') return clip.params[1] * 1080 * (scale / 100);
		if (clip.source.info.type !== 'video' && clip.source.info.type !== 'image') return 0;
		return clip.params[1] * clip.source.info.resolution.height * (scale / 100);
	});
	let position = $derived({
		top:
			canvasContainer.clientHeight / 2 -
			boxSizeHeight / 2 -
			(clip.params[3] / 2) * programState.canvasHeight * (scale / 100),
		left:
			canvasContainer.clientWidth / 2 -
			boxSizeWidth / 2 +
			(clip.params[2] / 2) * programState.canvasWidth * (scale / 100)
	});
	let cropBoxSize = $derived({
		top: boxSizeHeight * clip.params[12] - 2,
		left: boxSizeWidth * clip.params[15] - 2,
		height: Math.max(0, boxSizeHeight * (1 - clip.params[12] - clip.params[14])),
		width: Math.max(0, boxSizeWidth * (1 - clip.params[15] - clip.params[13]))
	});

	const mouseMove = (e: MouseEvent) => {
		if (cornerHover) {
			if (canvasContainer) canvasContainer.style.cursor = cornerHoverStyle;
		} else {
			if (canvasContainer) canvasContainer.style.cursor = 'default';
		}

		if (appState.mouseMoveOwner !== 'program') return;
		if (e.buttons < 1 || !timelineState.selectedClip) return;

		if (resizing) {
			if (!canvasContainer) return;
			const offsetX = e.clientX - canvasContainer.offsetLeft;
			const currentDistance = Math.sqrt(
				Math.pow(offsetX - savedClipCenter.x, 2) + Math.pow(e.clientY - savedClipCenter.y, 2)
			);
			const newScale = currentDistance / initialDistance;
			timelineState.selectedClip.params[0] = roundTo(savedClipScale.x * newScale, 3);
			timelineState.selectedClip.params[1] = roundTo(savedClipScale.y * newScale, 3);
			workerManager.sendClip(timelineState.selectedClip);
			if (timelineState.selectedClip.keyframeTracks.get(0)) {
				createOrUpdateKeyframe([0, 1]);
			}
			if (canvasContainer) canvasContainer.style.cursor = cornerHoverStyle;
		}
		if (cropping) {
			let currentPixelDistance, movedAmount;
			if (currentEdge === 0 || currentEdge === 2) {
				currentPixelDistance = e.clientY - initialPosition;
				movedAmount = currentPixelDistance / boxSizeHeight;
			} else {
				currentPixelDistance = e.clientX - canvasContainer.offsetLeft - initialPosition;
				movedAmount = currentPixelDistance / boxSizeWidth;
			}

			if (currentEdge === 2 || currentEdge === 1) movedAmount = -movedAmount;
			let newValue = savedClipCrop + movedAmount;
			if (newValue < 0) newValue = 0;
			const params = timelineState.selectedClip.params;
			if (currentEdge === 0 && newValue > 1 - params[14]) newValue = 1 - params[14];
			if (currentEdge === 3 && newValue > 1 - params[13]) newValue = 1 - params[13];
			timelineState.selectedClip.params[currentEdge + 12] = roundTo(newValue, 3);
			workerManager.sendClip(timelineState.selectedClip);
			if (timelineState.selectedClip.keyframeTracks.get(12)) {
				createOrUpdateKeyframe([12, 13, 14, 15]);
			}
		}
	};

	const mouseUp = () => {
		const clip = timelineState.selectedClip;
		if (!clip) return;
		if (resizing) {
			resizing = false;
			if (savedClipScale.x === clip.params[0] && savedClipScale.y === clip.params[1]) return;
			if (clip.keyframeTracks.get(0)) {
				finaliseKeyframe();
			} else {
				historyManager.pushAction({
					action: 'clipParam',
					data: {
						clipId: clip.id,
						paramIndex: [0, 1],
						oldValue: [savedClipScale.x, savedClipScale.y],
						newValue: [clip.params[0], clip.params[1]]
					}
				});
			}

			historyManager.finishCommand();
			projectManager.updateClip(clip);
		}
		if (cropping) {
			if (savedClipCrop === clip.params[currentEdge + 12]) return;
			if (clip.keyframeTracks.get(12)) {
				finaliseKeyframe();
			} else {
				historyManager.pushAction({
					action: 'clipParam',
					data: {
						clipId: clip.id,
						paramIndex: [currentEdge + 12],
						oldValue: [savedClipCrop],
						newValue: [clip.params[currentEdge + 12]]
					}
				});
			}
			historyManager.finishCommand();
			projectManager.updateClip(clip);
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

	const edgeMouseDown = (e: MouseEvent, clip: Clip, edge: number) => {
		e.stopPropagation();
		e.preventDefault();
		appState.mouseMoveOwner = 'program';
		appState.mouseIsDown = true;
		cropping = true;

		currentEdge = edge;
		if (edge === 0 || edge === 2) {
			initialPosition = e.clientY;
		} else {
			initialPosition = e.clientX - canvasContainer!.offsetLeft;
		}

		savedClipCrop = clip.params[edge + 12];
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
</script>

{#if clip.source.type === 'video' || clip.source.type === 'test' || clip.source.type === 'image'}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		style:transform={`rotate(${-clip.params[17]}deg)`}
		style:top={`${position.top}px`}
		style:left={`${position.left}px`}
		style:width={`${boxSizeWidth}px`}
		style:height={`${boxSizeHeight}px`}
		class={[
			cropping ? 'border-[rgba(255,255,255,0.5)]' : 'border-[rgba(255,255,255,0)]',
			'border-2  absolute top-0 left-0 border-dotted'
		]}
		oncontextmenu={(e) => {
			e.preventDefault();
			contextMenu.openContextMenu(e);
		}}
	>
		<div
			style:top={`${cropBoxSize.top}px`}
			style:left={`${cropBoxSize.left}px`}
			style:width={`${cropBoxSize.width}px`}
			style:height={`${cropBoxSize.height}px`}
			class="absolute border-2 border-white"
		>
			{#if cropping}
				{#if cropBoxSize.width > 44}
					{@render cropBox(0)}
					{@render cropBox(2)}
				{/if}
				{#if cropBoxSize.height > 44}
					{@render cropBox(1)}
					{@render cropBox(3)}
				{/if}
			{:else}
				{@render cornerBox(0)}
				{@render cornerBox(1)}
				{@render cornerBox(2)}
				{@render cornerBox(3)}
			{/if}
			{#snippet cropBox(edge: number)}
				<div
					onmouseenter={() => {
						cornerHover = true;
						cornerHoverStyle = edge === 0 || edge === 2 ? 'ns-resize ' : 'ew-resize';
					}}
					onmouseleave={() => {
						cornerHover = false;
					}}
					onmousedown={(e) => edgeMouseDown(e, clip, edge)}
					class={[
						edge === 0 && '-top-[5px] left-[calc(50%-20px)]',
						edge === 2 && '-bottom-[5px] left-[calc(50%-20px)]',
						edge === 3 && 'top-[calc(50%-20px)] -left-[5px]',
						edge === 1 && 'bottom-[calc(50%-20px)] -right-[5px]',
						edge === 0 || edge === 2 ? 'h-[10px] w-[40px]' : 'h-[40px] w-[10px]',
						'border-2 rounded-[5px] border-white absolute   bg-zinc-900'
					]}
				></div>
			{/snippet}
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
							x: position.left + boxSizeWidth / 2,
							y: position.top + boxSizeHeight / 2
						})}
					class={[
						corner === 0 || corner === 2 ? '-top-[7px]' : '-bottom-[7px]',
						corner === 0 || corner === 1 ? '-left-[7px]' : '-right-[7px]',
						'h-[14px] w-[14px] border-2 rounded-[5px] border-white absolute  bg-zinc-900'
					]}
				></div>
			{/snippet}
		</div>
	</div>
{/if}
{#if clip.source.type === 'text'}
	{@const { x, y } = getTextBoundingBox(clip.text, clip.params[6], scale, clip.params[7])}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		style:top={`${position.top + boxSizeHeight / 2 - y / 2}px`}
		style:left={`${position.left + boxSizeWidth / 2 - x / 2}px`}
		style:width={`${x}px`}
		style:height={`${y}px`}
		class="border-2 border-white absolute top-0 left-0"
		oncontextmenu={(e) => {
			e.preventDefault();
			//contextMenu.openContextMenu(e);
		}}
	></div>
{/if}

<ContextMenu
	bind:this={contextMenu}
	buttons={[
		{
			text: 'scale to fit',
			onClick: () => {
				const clip = timelineState.selectedClip;
				if (!clip) return;
				const { scale, x, y } = getClipFitTransform(clip);
				transformClip(clip, scale, scale, x, y);
			},
			icon: scaleToFitIcon,
			shortcuts: []
		},
		{
			text: 'scale to fill',
			onClick: () => {
				const clip = timelineState.selectedClip;
				if (!clip) return;
				const { scale, x, y } = getClipFillTransform(clip);
				transformClip(clip, scale, scale, x, y);
			},
			icon: scaleToFillIcon,
			shortcuts: []
		}
	]}
/>
<svelte:window
	onmousemove={mouseMove}
	onmouseup={mouseUp}
	onkeydown={(e) => {
		if (appState.disableKeyboardShortcuts) return;
		switch (e.code) {
			case 'ShiftLeft': {
				if (e.ctrlKey || dragging) return;
				if (timelineState.selectedClip?.source.type === 'test') return;
				cropping = true;
				break;
			}
		}
	}}
	onkeyup={(e) => {
		if (appState.disableKeyboardShortcuts) return;
		switch (e.code) {
			case 'ShiftLeft': {
				cropping = false;
				cornerHover = false;
				canvasContainer.style.cursor = 'default';
				break;
			}
		}
	}}
/>
