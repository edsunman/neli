<script lang="ts">
	import { Portal } from 'bits-ui';
	import type { Component } from 'svelte';

	type Props = {
		buttons: {
			text: string;
			icon: Component | null;
			onclick: () => void;
			shortcuts: (string | Component)[];
		}[];
	};

	let { buttons }: Props = $props();

	let showContextMenu = $state(false);
	const contextMenuPosition = $state({ x: 0, y: 0 });

	export const openContextMenu = (e: MouseEvent) => {
		showContextMenu = true;
		contextMenuPosition.x = e.clientX;
		contextMenuPosition.y = e.clientY;
	};
</script>

{#if showContextMenu}
	<Portal>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="h-dvh w-dvw absolute top-0 left-0 z-10"
			onmousedown={() => {
				showContextMenu = false;
			}}
		>
			<div
				style:top={`${contextMenuPosition.y + 5}px`}
				style:left={`${contextMenuPosition.x + 5}px`}
				class="absolute bg-zinc-200 p-1 rounded-lg text-sm flex flex-col"
				onmousedown={(e) => {
					e.stopPropagation();
				}}
			>
				{#each buttons as button}
					<button
						class="px-2 py-1.5 rounded-lg text-left hover:bg-zinc-350 group flex items-center justify-between"
						onclick={() => {
							button.onclick();
							showContextMenu = false;
						}}
					>
						<span>
							{#if button.icon}
								<button.icon class="size-4 inline mr-2" />
							{/if}
							{button.text}
						</span>
						{#if button.shortcuts.length > 0}
							<span class="ml-10 text-xs">
								{#each button.shortcuts as Shortcut, i}
									<span class="px-1.5 py-0.5 rounded-sm bg-zinc-350 group-hover:bg-zinc-370">
										{#if typeof Shortcut === 'string'}
											{Shortcut}
										{:else}
											<Shortcut class="size-3 inline relative -top-[1px]" />
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
