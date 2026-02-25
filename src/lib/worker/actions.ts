export const createThumbnail = async (
	image: ImageBitmap | VideoFrame,
	imageWidth: number,
	imageHeight: number
) => {
	const targetWidth = 192;
	const targetHeight = 108;

	const canvas = new OffscreenCanvas(targetWidth, targetHeight);
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not get 2D context from canvas');
	}

	const inputRatio = imageWidth / imageHeight;
	const targetRatio = targetWidth / targetHeight;
	let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

	if (inputRatio > targetRatio) {
		drawHeight = targetHeight;
		drawWidth = imageWidth * (targetHeight / imageHeight);
		offsetX = (targetWidth - drawWidth) / 2;
		offsetY = 0;
	} else {
		drawWidth = targetWidth;
		drawHeight = imageHeight * (targetWidth / imageWidth);
		offsetX = 0;
		offsetY = (targetHeight - drawHeight) / 2;
	}

	context.clearRect(0, 0, targetWidth, targetHeight);
	context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
	image.close();

	const blob = await canvas.convertToBlob({ type: 'image/png' });

	const db: IDBDatabase = await new Promise((resolve, reject) => {
		const request = indexedDB.open('ImageStorage', 1);
		request.onupgradeneeded = () => request.result.createObjectStore('images');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction('images', 'readwrite');
		tx.objectStore('images').put(blob, 'hello');
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});

	return URL.createObjectURL(blob);
};
