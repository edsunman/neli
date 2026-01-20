<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import { type Snippet } from 'svelte';

	type Props = Tooltip.RootProps & {
		trigger: Snippet;
		triggerProps?: Tooltip.TriggerProps;
		contentProps?: Tooltip.ContentProps;
	};

	let {
		open = $bindable(false),
		trigger,
		children,
		triggerProps = {},
		contentProps = {}
	}: Props = $props();
</script>

<!--
 Ensure you have a `Tooltip.Provider` component wrapping
 your root layout content
-->
<Tooltip.Root bind:open>
	<Tooltip.Trigger {...triggerProps}>
		{@render trigger()}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content {...contentProps} sideOffset={15}>
			<div class="text-sm bg-zinc-200 px-3 py-2 relative rounded-lg z-8">
				{@render children?.()}
			</div>
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
