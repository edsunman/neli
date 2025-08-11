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
	<path d="M12 5L12 19" />
	<path d="M9 17L12 20L15 17" />
	<path d="M15 7L12 4L9 7" />
	<path d="M5 12L19 12" />
	<path d="M17 15L20 12L17 9" />
	<path d="M7 9L4 12L7 15" />
</svg>
