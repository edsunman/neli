<script>
	let { ...rest } = $props();
</script>

<svg
	{...rest}
	role="img"
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	fill="none"
>
	<polygon points="20 8 20 20 4 20 4 8" />
	<polyline stroke-linejoin="round" points="8 4 12 7.917 16 4" />
</svg>
