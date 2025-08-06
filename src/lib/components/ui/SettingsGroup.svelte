<script lang="ts">
	let { children, label } = $props();
</script>

<div class="text-sm font-medium mt-2">
	<span class="select-none">{label}</span>
	<div class="mt-2">
		{@render children()}
	</div>
</div>
