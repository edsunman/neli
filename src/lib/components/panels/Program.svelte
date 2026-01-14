<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, historyManager, timelineState } from '$lib/state.svelte';
	import { setupWorker, updateWorkerClip } from '$lib/worker/actions.svelte';
	import type { Clip } from '$lib/clip/clip.svelte';
	import { undoIcon } from '../icons/Icons.svelte';
	import { getClipsAtFrame } from '$lib/clip/actions';
	import { getClipInitialScaleFactor } from '$lib/clip/utils';

	import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
	import { measureText } from '$lib/text/utils';
	import SourceTimeline from '../timeline/SourceTimeline.svelte';
	import { showClipPropertiesSection } from '$lib/properties/actions';

	let canvas = $state<HTMLCanvasElement>();
	let canvasContainer = $state<HTMLDivElement>();
	let contextMenu: ContextMenu;

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

	const mouseUp = (e: MouseEvent) => {
		if (appState.mouseMoveOwner !== 'program') return;
		appState.mouseMoveOwner = 'timeline';
		appState.mouseIsDown = false;
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

	const canvasMouseDown = (e: MouseEvent) => {
		timelineState.selectedClip = null;
		const clips = getClipsAtFrame(timelineState.currentFrame);
		for (const clip of clips) {
			if (clip.source.type === 'audio') continue;
			const box = { height: 0, width: 0, centerX: 0, centerY: 0 };
			if (clip.source.type === 'text') {
				const measurements = measureText(clip.text, appState.fonts[0], clip.params[7]);
				// scale factor based on font size and arbitrary number
				const scaleFactor = clip.params[6] / 9.3;
				box.width = measurements.width * scaleFactor;
				box.height = measurements.height * scaleFactor;
			} else {
				box.width = clip.source.width * clip.params[0];
				box.height = clip.source.height * clip.params[1];
			}
			box.centerX = (clip.params[2] / 2 + 0.5) * 1920;
			box.centerY = (1 - (clip.params[3] / 2 + 0.5)) * 1080;
			if (
				e.offsetX > box.centerX - box.width / 2 &&
				e.offsetX < box.centerX + box.width / 2 &&
				e.offsetY > box.centerY - box.height / 2 &&
				e.offsetY < box.centerY + box.height / 2
			) {
				timelineState.selectedClip = clip;
				showClipPropertiesSection(clip);
				break;
			}
		}
		timelineState.invalidate = true;
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
			text: 'reset transform',
			icon: undoIcon,
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
				const scaleFactor = getClipInitialScaleFactor(clip);
				clip.params[0] = scaleFactor;
				clip.params[1] = scaleFactor;
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

<div class="flex flex-col h-full">
	<div
		class="flex-1 relative overflow-hidden"
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
				onmousedown={canvasMouseDown}
				oncontextmenu={(e) => {
					e.preventDefault();
				}}
			></canvas>
		</div>
		{#if timelineState.selectedClip && !timelineState.selectedClip.temp && timelineState.currentFrame >= timelineState.selectedClip.start && timelineState.currentFrame < timelineState.selectedClip.start + timelineState.selectedClip.duration}
			{@const clip = timelineState.selectedClip}
			{@const boxSizeX = clip.params[0] * clip.source.width * (scale / 100)}
			{@const boxSizeY = clip.params[1] * clip.source.height * (scale / 100)}
			{@const offsetX = (clip.params[2] / 2) * 1920 * (scale / 100)}
			{@const offsetY = (clip.params[3] / 2) * 1080 * (scale / 100)}
			{@const top = height / 2 - boxSizeY / 2 - offsetY}
			{@const left = width / 2 - boxSizeX / 2 + offsetX}
			{#if clip.source.type === 'video' || clip.source.type === 'test' || clip.source.type === 'image'}
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
			{#if clip.source.type === 'text'}
				{@const { x, y } = getTextBoundingBox(clip.text, clip.params[6], scale, clip.params[7])}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					style:top={`${top + boxSizeY / 2 - y / 2}px`}
					style:left={`${left + boxSizeX / 2 - x / 2}px`}
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
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- <div
				onmouseenter={() => {
					cornerHover = true;
					cornerHoverStyle = 'move';
				}}
				onmouseleave={() => {
					cornerHover = false;
				}}
				onmousedown={(e) => {
					if (e.button > 0) return;
					e.preventDefault();
					dragging = true;
					savedClipPosition = { x: clip.params[2], y: clip.params[3] };
					mouseDownPosition = { x: e.clientX, y: e.clientY };
					appState.mouseMoveOwner = 'program';
					appState.mouseIsDown = true;
				}}
				style:top={`${top + boxSizeY / 2 - 7}px`}
				style:left={`${left + boxSizeX / 2 - 7}px`}
				class={['h-[14px] w-[14px] border-2 rounded-[5px] border-white absolute  bg-zinc-900']}
			></div> -->
			{/if}
		{/if}
	</div>
	{#if appState.selectedSource}
		<SourceTimeline />
	{/if}
</div>
<ContextMenu bind:this={contextMenu} {buttons} />

<svelte:window onmousemove={mouseMove} onmouseup={mouseUp} />
