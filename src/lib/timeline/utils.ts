export const canvasOffsetToFrame = (
	canvasOffset: number,
	canvasWidth: number,
	timelineDuration: number
) => {
	const percentOfTimeline = canvasOffset / canvasWidth; // between 0 and 1
	return Math.floor(percentOfTimeline * timelineDuration);
};

export const frameToCanvasOffset = (
	frame: number,
	timelineDuration: number,
	canvasWidth: number
) => {
	const percentOfDuration = frame / timelineDuration;
	return Math.floor(percentOfDuration * canvasWidth);
};
