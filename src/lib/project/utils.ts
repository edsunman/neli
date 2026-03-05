export const getNextProjectName = (existingNames: string[]) => {
	const baseName = 'untitled';
	if (!existingNames.includes(baseName)) return baseName;

	const regex = /^untitled \((\d+)\)$/;

	let maxNumber = 0;
	existingNames.forEach((name) => {
		const match = name.match(regex);
		if (match) {
			const num = parseInt(match[1], 10);
			if (num > maxNumber) {
				maxNumber = num;
			}
		}
	});

	return `${baseName} (${maxNumber + 1})`;
};

/**
 * Converts a Date.now() timestamp into a human-readable relative string.
 * @param timestamp - The timestamp number to compare.
 * @returns A string like "5 minutes ago" or "2 days ago".
 */
export const getRelativeTime = (timestamp: number) => {
	const now = Date.now();
	const secondsAgo = Math.floor((now - timestamp) / 1000);
	if (secondsAgo < 1) return 'just now';

	const intervals: { [key: string]: number } = {
		day: 86400,
		hour: 3600,
		minute: 60,
		second: 1
	};

	for (const [unit, secondsInUnit] of Object.entries(intervals)) {
		const interval = Math.floor(secondsAgo / secondsInUnit);
		if (interval >= 1) {
			return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
		}
	}

	return 'just now';
};
