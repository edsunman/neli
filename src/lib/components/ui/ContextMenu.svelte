<script lang="ts">
	import { Portal } from 'bits-ui';
	import { onMount, tick, type Snippet } from 'svelte';

	type Props = {
		buttons: {
			text: string;
			icon: Snippet<[string]> | null;
			onclick: () => void;
			shortcuts: (string | Snippet<[string]>)[];
		}[];
	};

	let { buttons }: Props = $props();

	let container = $state<HTMLDivElement>();
	let contextMenu = $state<HTMLDivElement>();
	let showContextMenu = $state(false);
	const contextMenuPosition = $state({ x: 0, y: 0 });

	export const openContextMenu = async (e: MouseEvent) => {
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
			onmousedown={() => {
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
				{#each buttons as button}
					<button
						class="px-2 py-1.5 rounded-lg text-left hover:bg-zinc-350 group flex items-center justify-between whitespace-nowrap"
						onclick={() => {
							button.onclick();
							showContextMenu = false;
						}}
					>
						<span>
							{#if button.icon}
								{@render button.icon('size-4 inline mr-2')}
							{/if}
							{button.text}
						</span>
						{#if button.shortcuts.length > 0}
							<span class="ml-10 text-xs">
								{#each button.shortcuts as shortcut, i}
									<span class="px-1.5 py-0.5 rounded-sm bg-zinc-350 group-hover:bg-zinc-370">
										{#if typeof shortcut === 'string'}
											{shortcut}
										{:else}
											{@render shortcut('size-3 inline relative -top-[1px]')}
										{/if}
									</span>
									{i + 1 < button.shortcuts.length ? '+ ' : ''}
								{/each}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</Portal>
{/if}
