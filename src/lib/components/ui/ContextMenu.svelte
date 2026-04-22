<script lang="ts">
	import { Portal } from 'bits-ui';
	import { tick, type Snippet } from 'svelte';
	import { forwardArrowIcon } from '../icons/Icons.svelte';

	type Props = {
		buttons: {
			text: string;
			icon?: Snippet<[string]>;
			onClick: () => void;
			shortcuts?: (string | Snippet<[string]>)[];
			disableCondition?: () => boolean;
			hideCondition?: () => boolean;
			children?: {
				text: string;
				onClick: () => void;
			}[];
		}[];
		onClose?: () => void;
	};

	let { buttons, onClose }: Props = $props();

	let container = $state<HTMLDivElement>();
	let contextMenu = $state<HTMLDivElement>();
	let showContextMenu = $state(false);
	const contextMenuPosition = $state({ x: 0, y: 0 });
	let showChildId = $state(-1);

	export const openContextMenu = async (e: MouseEvent) => {
		e.preventDefault();
		showChildId = -1;
		showContextMenu = true;
		contextMenuPosition.x = e.clientX;
		contextMenuPosition.y = e.clientY;

		await tick();
		if (!container || !contextMenu) return;
		if (container.clientWidth - 10 < contextMenuPosition.x + contextMenu.clientWidth) {
			contextMenuPosition.x = e.clientX - contextMenu.clientWidth;
		}
		if (container.clientHeight - 10 < contextMenuPosition.y + contextMenu.clientHeight) {
			contextMenuPosition.y = e.clientY - contextMenu.clientHeight;
		}
	};
</script>

{#if showContextMenu}
	<Portal to="#portalContainer">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={container}
			class="h-dvh w-dvw absolute top-0 left-0 z-10"
			onmousemove={(e) => e.stopPropagation()}
			onmouseup={(e) => e.stopPropagation()}
			onmousedown={() => {
				if (onClose) onClose();
				showContextMenu = false;
			}}
		>
			<div
				bind:this={contextMenu}
				style:top={`${contextMenuPosition.y + 5}px`}
				style:left={`${contextMenuPosition.x + 5}px`}
				class="absolute bg-zinc-200 p-1 rounded-lg text-sm flex flex-col"
				onmousedown={(e) => {
					e.stopPropagation();
				}}
			>
				{#each buttons as button, i (button.text)}
					{#if !button.hideCondition || (button.hideCondition && !button.hideCondition())}
						{@const disabled = button.disableCondition && button.disableCondition()}
						<button
							{disabled}
							class={[
								disabled ? 'text-zinc-400' : 'hover:bg-zinc-350',
								button.children && showChildId === i ? 'bg-zinc-350' : '',
								'px-2 py-1.5 rounded-lg text-left  group flex items-center  whitespace-nowrap'
							]}
							onmouseenter={() => (showChildId = i)}
							onclick={() => {
								if (button.children) return;
								button.onClick();
								if (onClose) onClose();
								showContextMenu = false;
							}}
						>
							<span class="mr-2 flex">
								{#if button.icon}
									{@render button.icon('size-4 inline')}
								{/if}
							</span>
							<span class="mr-3">{button.text}</span>
							{#if button.shortcuts && button.shortcuts.length > 0}
								<span class="ml-5 text-xs text-zinc-500">
									{#each button.shortcuts as shortcut (shortcut)}
										<span class="px-1.5 py-0.5 ml-1 rounded-sm border border-zinc-400">
											{#if typeof shortcut === 'string'}
												{shortcut}
											{:else}
												{@render shortcut('size-3 inline relative -top-[1px]')}
											{/if}
										</span>
									{/each}
								</span>
							{/if}
							{#if button.children}
								<span class="ml-auto text-zinc-700 flex">
									{@render forwardArrowIcon('size-3 inline')}
								</span>
							{/if}
						</button>
					{/if}
				{/each}
			</div>
			{#each buttons as button, i (button.text)}
				{#if button.children && showChildId === i}
					<div
						{@attach (ref) => {
							if (!contextMenu || !container) return;
							let top = contextMenuPosition.y + 32 * i;
							let left = contextMenuPosition.x + contextMenu.clientWidth + 10;
							if (container.clientHeight - 10 < top + ref.clientHeight) {
								// hit bottom
								top = top - ref.clientHeight + 50;
							}
							if (container.clientWidth - 10 < left + ref.clientWidth) {
								// hit bottom
								left = left - contextMenu.clientWidth - ref.clientWidth - 10;
							}
							ref.style.top = `${top}px`;
							ref.style.left = `${left}px`;
						}}
						onmousedown={(e) => {
							e.stopPropagation();
						}}
						class="absolute bg-zinc-200 p-1 rounded-lg text-sm flex flex-col"
					>
						{#each button.children as child (child.text)}
							<button
								onclick={() => {
									child.onClick();
									if (onClose) onClose();
									showContextMenu = false;
								}}
								class="px-2 py-1.5 rounded-lg text-left group flex items-center whitespace-nowrap hover:bg-zinc-350"
							>
								<span class="mr-4">{child.text}</span>
							</button>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	</Portal>
{/if}
