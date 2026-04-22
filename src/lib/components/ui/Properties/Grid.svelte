<script lang="ts">
	let { children } = $props();
</script>

<div class="grid grid-cols-2 gap-2">
		{@render children()}
</div>
