<script lang="ts">
	let { children, label, className = [] } = $props();
</script>

<div class="text-sm font-medium flex flex-col items-end">
	<span class="select-none">{label}</span>
	<div class={['mt-2 flex justify-end gap-2 flex-wrap', ...className]}>
		{@render children()}
	</div>
</div>
