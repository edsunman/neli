export const formatStorageSize = (bytes: number): string => {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	const value = bytes / Math.pow(k, i);
	return `${value.toFixed(2)} ${sizes[i]}`;
};
