import { onDestroy } from 'svelte';

export const useAnimationFrame = () => {
	let frameId: number | null = null;
	let callback: ((timestamp: number) => void) | null = null;
	let isRunning = false;

	const loop = (timestamp: number) => {
		if (!isRunning) return;
		if (callback) callback(timestamp);
		frameId = requestAnimationFrame(loop);
	};

	const play = () => {
		if (!isRunning) {
			isRunning = true;
			frameId = requestAnimationFrame(loop);
		}
	};

	const pause = () => {
		isRunning = false;
		if (frameId) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}
	};

	const onFrame = (fn: (timestamp: number) => void) => {
		callback = fn;
		play();
	};

	onDestroy(() => {
		pause();
	});

	return { onFrame, play, pause };
};
