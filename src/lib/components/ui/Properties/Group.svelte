<script lang="ts">
	let { children, label, className = [] } = $props();
</script>

<div class="text-sm font-medium flex flex-col items-end w-full">
	<span class="select-none">{label}</span>
	<div class={['mt-2 flex flex-col items-end w-full gap-1', ...className]}>
		{@render children()}
	</div>
</div>
