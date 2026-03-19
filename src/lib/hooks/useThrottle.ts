export const useThrottle = () => {
	let frameId: number | null = null;
	return (callback: () => void) => {
		if (frameId) return;
		frameId = requestAnimationFrame(() => {
			callback();
			frameId = null;
		});
	};
};
