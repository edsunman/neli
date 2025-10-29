<script lang="ts" module>
	export {
		addIcon,
		audioIcon,
		backIcon,
		copyIcon,
		exportIcon,
		filmIcon,
		folderIcon,
		forwardIcon,
		helpIcon,
		importIcon,
		infoIcon,
		justifyLeftIcon,
		justifyCenterIcon,
		justifyRightIcon,
		logoIcon,
		mouseIcon,
		moveIcon,
		paletteIcon,
		pauseIcon,
		playIcon,
		redoIcon,
		seekIcon,
		settingsIcon,
		speakerIcon,
		spinningIcon,
		testIcon,
		textIcon,
		undoIcon,
		zoomInIcon,
		zoomOutIcon
	};
</script>

{#snippet addIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M17 12L7 12M12 17L12 7" /><!-- <circle cx="12" cy="12" r="10" /> -->
	</svg>
{/snippet}

{#snippet audioIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M12 7L12 17" /> <path d="M15 10L15 14" /> <path d="M18 8L18 16" />
		<path d="M21 13L21 11" /> <path d="M9 4L9 20" /> <path d="M6 9L6 15" /> <path d="M3 13L3 11" />
	</svg>
{/snippet}

{#snippet backIcon(className: string)}
	<svg
		class={className}
		role="img"
		id="Layer_1"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 240 240"
		fill="currentColor"
	>
		<path
			d="M26.18,96.87l80.42-46.43c17.8-10.28,40.06,2.57,40.06,23.13v92.86c0,20.56-22.25,33.4-40.06,23.13l-80.42-46.43c-17.8-10.28-17.8-35.97,0-46.25Z"
		/><rect
			x="178.92"
			y="46"
			width="45.61"
			height="148"
			rx="22.8"
			ry="22.8"
			transform="translate(403.46 240) rotate(-180)"
		/>
	</svg>
{/snippet}

{#snippet copyIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<rect width="12" height="14" x="8" y="7" /> <polyline points="16 3 4 3 4 17" />
	</svg>
{/snippet}

{#snippet exportIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M12,3 L12,16" /> <polyline points="7 12 12 17 17 12" /> <path d="M20,21 L4,21" />
	</svg>
{/snippet}

{#snippet filmIcon(className: string)}
	<svg
		class={className}
		version="1.1"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 256 256"
		fill="currentColor"
	>
		<path
			d="M218.2,30.8H37.8C22.4,30.8,10,43.2,10,58.6v138.8c0,15.3,12.4,27.8,27.8,27.8h180.5c15.3,0,27.8-12.4,27.8-27.8V58.6C246,43.2,233.6,30.8,218.2,30.8z M65.5,197.4H37.8v-27.8h27.8V197.4L65.5,197.4z M65.5,141.9H37.8v-27.7h27.8V141.9L65.5,141.9z M65.5,86.4H37.8V58.6h27.8V86.4L65.5,86.4z M218.2,197.4h-27.8v-27.8h27.8V197.4z M218.2,141.9h-27.8v-27.7h27.8V141.9z M218.2,86.4h-27.8V58.6h27.8V86.4z"
		/>
	</svg>
{/snippet}

{#snippet folderIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M3 5h6l1 2h11v12H3z" />
	</svg>
{/snippet}

{#snippet forwardIcon(className: string)}
	<svg
		class={className}
		role="img"
		id="Layer_1"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 240 240"
		fill="currentColor"
	>
		<path
			d="M211.18,143.13l-80.42,46.43c-17.8,10.28-40.06-2.57-40.06-23.13v-92.86c0-20.56,22.25-33.4,40.06-23.13l80.42,46.43c17.8,10.28,17.8,35.97,0,46.25Z"
		/><rect x="12.83" y="46" width="45.61" height="148" rx="22.8" ry="22.8" />
	</svg>
{/snippet}

{#snippet helpIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 48 48"
		stroke="currentColor"
		stroke-width="4"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path
			d="M24.02,26.95c0-3.48,2.74-4.06,3.68-5,.95-.94,1.53-2.25,1.53-3.69,0-2.88-2.33-5.21-5.21-5.21-1.56,0-2.95.68-3.91,1.76-.44.5-.79,1.09-1.01,1.73"
		/><line x1="24" y1="34" x2="24" y2="34" /><circle cx="24" cy="24" r="20" />
	</svg>
{/snippet}

{#snippet importIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M12,4 L12,17" /> <polyline points="7 8 12 3 17 8" /> <path d="M20,21 L4,21" />
	</svg>
{/snippet}

{#snippet infoIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M12,12 L12,15" /> <line x1="12" y1="9" x2="12" y2="9" />
		<circle cx="12" cy="12" r="10" />
	</svg>
{/snippet}

{#snippet justifyLeftIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M6 10L14 10M6 6L18 6M6 14L18 14M6 18L14 18" />
	</svg>
{/snippet}

{#snippet justifyCenterIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M8 10L16 10M6 6L18 6M6 14L18 14M8 18L16 18" />
	</svg>
{/snippet}

{#snippet justifyRightIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M10 10h8M6 6h12M6 14h12m-8 4h8" />
	</svg>
{/snippet}

{#snippet logoIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 283.8 439.33"
		fill="currentColor"
	>
		<path
			d="M205.18,4.25h-126.57C38.77,4.25,6.47,36.56,6.47,76.4v129.35c0,33.88,8.16,67.27,23.78,97.33l47.62,91.63c26.94,51.84,101.11,51.84,128.04,0l47.65-91.73c15.61-30.06,23.77-63.43,23.77-97.3V76.4c0-39.84-32.3-72.15-72.15-72.15ZM218.34,120.51c0,22.58-5.43,44.3-15.84,64.34l-24.47,47.1c-15.2,29.26-57.07,29.27-72.27,0l-24.45-47.05c-10.42-20.04-15.85-41.77-15.85-64.35v-12.61c0-22.49,18.23-40.72,40.72-40.72h71.44c22.49,0,40.72,18.23,40.72,40.72v12.56Z"
		/>
	</svg>
{/snippet}

{#snippet mouseIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M5 10L12 10M19 10L12 10M12 10L12 2.5" /><path
			d="M5 9C5 5.13401 8.13401 2 12 2V2C15.866 2 19 5.13401 19 9V15C19 18.866 15.866 22 12 22V22C8.13401 22 5 18.866 5 15V9Z"
		/>
	</svg>
{/snippet}

{#snippet moveIcon(className: string)}
	<svg
		class={className}
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
{/snippet}

{#snippet paletteIcon(className: string)}
	<svg
		class={className}
		role="img"
		id="Layer_1"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 -960 960 960"
		fill="currentColor"
	>
		<path
			d="m717.13-430 91 91v176.13q0 37.78-26.61 64.39t-64.39 26.61H162.87q-37.78 0-64.39-26.61t-26.61-64.39v-554.26q0-37.78 26.61-64.39t64.39-26.61H380q-9.91 19.91-15.23 44.12-5.31 24.21-6.84 46.88H162.87v554.26h554.26V-430Zm58.94-172.8 130.86 130.87-58.86 58.86L717.2-543.93q-21 12-45.6 19.76-24.6 7.76-51.6 7.76-76.49 0-130.04-53.54-53.55-53.53-53.55-130.01 0-76.47 53.54-130.05 53.53-53.58 130.01-53.58 76.47 0 130.05 53.55 53.58 53.55 53.58 130.04 0 27-7.76 51.6t-19.76 45.6ZM620-600q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29ZM162.87-430v267.13-554.26V-436.41v-12V-430Z"
		/>
	</svg>
{/snippet}

{#snippet pauseIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 240 240"
		fill="currentColor"
	>
		<rect x="21.71" y="12.01" width="72.27" height="218.54" rx="35.8" ry="35.8" /><rect
			x="145.38"
			y="12.01"
			width="72.27"
			height="218.54"
			rx="36.13"
			ry="36.13"
		/>
	</svg>
{/snippet}

{#snippet playIcon(className: string)}
	<svg
		class={className}
		role="img"
		id="Layer_1"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 240 240"
		fill="currentColor"
	>
		<path
			d="M203.5,148.44l-134.43,77.62c-21.04,12.15-47.35-3.04-47.35-27.34V43.48c0-24.3,26.31-39.49,47.35-27.34l134.43,77.62c21.04,12.15,21.04,42.53,0,54.68Z"
		/>
	</svg>
{/snippet}

{#snippet redoIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M19,17 L19,15 C19,10.0294373 15.1944204,6 10.5,6 C5.80557963,6 2,10.0294373 2,15" />
		<polyline points="16 15 19 18 22 15" />
	</svg>
{/snippet}

{#snippet seekIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path
			d="M6.58748441 4.80875867C4.40860039 6.45129836 3 9.06115105 3 12 3 16.9705627 7.02943725 21 12 21 16.9705627 21 21 16.9705627 21 12 21 7.02943725 16.9705627 3 12 3L12 7M12 13L8 9"
		/>
	</svg>
{/snippet}

{#snippet settingsIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path
			d="M5.03506429,12.7050339 C5.01187484,12.4731696 5,12.2379716 5,12 C5,11.7620284 5.01187484,11.5268304 5.03506429,11.2949661 L3.20577137,9.23205081 L5.20577137,5.76794919 L7.9069713,6.32070904 C8.28729123,6.0461342 8.69629298,5.80882212 9.12862533,5.61412402 L10,3 L14,3 L14.8713747,5.61412402 C15.303707,5.80882212 15.7127088,6.0461342 16.0930287,6.32070904 L18.7942286,5.76794919 L20.7942286,9.23205081 L18.9649357,11.2949661 C18.9881252,11.5268304 19,11.7620284 19,12 C19,12.2379716 18.9881252,12.4731696 18.9649357,12.7050339 L20.7942286,14.7679492 L18.7942286,18.2320508 L16.0930287,17.679291 C15.7127088,17.9538658 15.303707,18.1911779 14.8713747,18.385876 L14,21 L10,21 L9.12862533,18.385876 C8.69629298,18.1911779 8.28729123,17.9538658 7.9069713,17.679291 L5.20577137,18.2320508 L3.20577137,14.7679492 L5.03506429,12.7050339 Z"
		/> <circle cx="12" cy="12" r="1" />
	</svg>
{/snippet}

{#snippet speakerIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M13 5v14l-5-4H3V9h5z" />
		<path stroke-linecap="round" d="M13 14c1.5-1 1.5-3 0-4" />
		<path
			d="M16 16C18.0858253 13.9141747 18.0858253 10.0858253 16 8M18 19C21.98552 15.01448 22.0076803 9.00768033 18 5"
		/>
	</svg>
{/snippet}

{#snippet spinningIcon(className: string)}
	<svg
		class={['animate-spin', className]}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 64 64"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path
			d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
			stroke="currentColor"
			stroke-width="8"
			stroke-linecap="round"
			stroke-linejoin="round"
		></path><path
			d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
			stroke="currentColor"
			stroke-width="15"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="text-zinc-900"
		></path>
	</svg>
{/snippet}

{#snippet testIcon(className: string)}
	<svg
		class={className}
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
{/snippet}

{#snippet textIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M4 8L5 4H12M20 8L19 4H12M12 4V20M12 20H8M12 20H16" />
	</svg>
{/snippet}

{#snippet undoIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M5,17 L5,15 C5,10.0294373 8.80557963,6 13.5,6 C18.1944204,6 22,10.0294373 22,15" />
		<polyline points="8 15 5 18 2 15" />
	</svg>
{/snippet}

{#snippet zoomInIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path d="M4,20 L9.58788778,14.4121122" /><path
			d="M14,16 C10.6862915,16 8,13.3137085 8,10 C8,6.6862915 10.6862915,4 14,4 C17.3137085,4 20,6.6862915 20,10 C20,13.3137085 17.3137085,16 14,16 Z"
		/> <path d="M16.6666667 10L11.3333333 10M14 7.33333333L14 12.6666667" />
	</svg>
{/snippet}

{#snippet zoomOutIcon(className: string)}
	<svg
		class={className}
		role="img"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	>
		<path
			d="M14,16 C10.6862915,16 8,13.3137085 8,10 C8,6.6862915 10.6862915,4 14,4 C17.3137085,4 20,6.6862915 20,10 C20,13.3137085 17.3137085,16 14,16 Z"
		/> <path d="M16.6666667 10L11.3333333 10M4 20L9.58788778 14.4121122" />
	</svg>
{/snippet}
