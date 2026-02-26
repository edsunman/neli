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
