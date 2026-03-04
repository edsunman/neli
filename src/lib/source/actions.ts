import { appState, projectManager, workerManager } from '$lib/state.svelte';
import { Source } from './source.svelte';
import { Input, ALL_FORMATS, BlobSource, EncodedPacketSink, AudioSampleSink } from 'mediabunny';
import type { FileInfo, SourceType, SrtEntry } from '$lib/types';

export const createSource = (type: SourceType, info: FileInfo, file?: File) => {
	const newSource = new Source(type, info);

	if (type === 'text') newSource.name = 'Text';
	if (type === 'test') newSource.name = 'Test video';
	if (info.type === 'video') newSource.selection.out = Math.round(info.duration * info.frameRate);
	if (info.type === 'audio') newSource.selection.out = Math.round(info.duration * 30);

	if (file) {
		const lastDotIndex = file.name.lastIndexOf('.');
		const nameNoExt = lastDotIndex === -1 ? file.name : file.name.slice(0, lastDotIndex);
		newSource.name = nameNoExt;
		newSource.file = file;
	}

	appState.sources.push(newSource);
	assignSourcesToFolders();

	return newSource;
};

export const assignSourcesToFolders = () => {
	appState.sourceFolders.length = 0;

	const sourceCount = appState.sources.filter(
		(source) => source.type !== 'text' && source.type !== 'test'
	).length;

	let folderId = 0;
	for (let i = 0; i < sourceCount / 7; i++) {
		folderId++;
		appState.sourceFolders.push({ id: folderId });
	}

	let i = 0;
	for (const source of appState.sources) {
		if (source.type === 'text' || source.type === 'test') {
			source.folderId = 0;
			continue;
		}
		source.folderId = Math.floor(i / 7) + 1;
		i++;
	}

	appState.selectedSourceFolder = folderId;
};

export const createVideoSource = async (file: File, info: FileInfo, existingSource?: Source) => {
	let newSource;

	if (existingSource) {
		newSource = existingSource;
		newSource.file = file;
	} else {
		newSource = createSource('video', info, file);
	}

	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(file)
	});

	const audioTrack = await input.getPrimaryAudioTrack();
	const audioConfig = await audioTrack?.getDecoderConfig();

	if (audioTrack && audioConfig) {
		// file has audio track
		newSource.sink = new EncodedPacketSink(audioTrack);
		newSource.sampleSink = new AudioSampleSink(audioTrack);
		newSource.audioConfig = audioConfig;
	}

	const data = await workerManager.sendFile(newSource);
	if (!newSource.thumbnail && data.videoFrame) {
		const videoFrame = data.videoFrame as VideoFrame;
		const blob = await createThumbnail(videoFrame, videoFrame.codedWidth, videoFrame.codedHeight);
		setSourceThumbnail(data.sourceId, blob);
		projectManager.createThumbnail(blob, newSource.id);
		appState.import.thumbnail = newSource.thumbnail;
	} else {
		data.videoFrame?.close();
	}

	const { waveform } = await workerManager.sendFileToWaveformWorker(newSource);
	newSource.audioWaveform = waveform;
	// timelineState.invalidateWaveform = true;
	return newSource;
};

export const createImageSource = async (file: File, info: FileInfo) => {
	const newSource = createSource('image', info, file);
	newSource.info = info;
	const data = await workerManager.sendFile(newSource);
	if (!newSource.thumbnail && data.bitmap) {
		const bitmap = data.bitmap as ImageBitmap;
		const blob = await createThumbnail(bitmap, bitmap.width, bitmap.height);
		setSourceThumbnail(data.sourceId, blob);
		projectManager.createThumbnail(blob, newSource.id);
		appState.import.thumbnail = newSource.thumbnail;
	} else {
		data.bitmap?.close();
	}
	return newSource;
};

export const createAudioSource = async (file: File, info: FileInfo) => {
	const newSource = createSource('audio', info, file);

	newSource.info = info;

	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(file)
	});

	const audioTrack = await input.getPrimaryAudioTrack();
	const audioConfig = await audioTrack?.getDecoderConfig();

	if (!audioTrack || !audioConfig) throw new Error('no audio config');

	newSource.sink = new EncodedPacketSink(audioTrack);
	newSource.sampleSink = new AudioSampleSink(audioTrack);
	newSource.audioConfig = audioConfig;

	const { waveform } = await workerManager.sendFileToWaveformWorker(newSource);
	newSource.audioWaveform = waveform;
	return newSource;
};

export const createSrtSource = async (file: File, info: FileInfo) => {
	const result = await readFileAsText(file);
	const srtEntries = parseSrt(result);
	const newSource = createSource('srt', info, file); //new Source('srt', file);
	newSource.srtEntries = srtEntries;
	return newSource;
};

export const processFile = async (file: File, handle?: FileSystemHandle) => {
	appState.import.importStarted = true;
	appState.import.warningMessage = '';
	appState.import.thumbnail = '';
	appState.import.fileDetails = {
		name: '',
		type: '',
		info: null
	};

	appState.import.fileDetails.name = file.name;
	appState.import.fileDetails.type = file.type;
	if (!file.type) {
		const lastDotIndex = file.name.lastIndexOf('.');
		const extension = file.name.slice(lastDotIndex);
		if (extension === '.srt') appState.import.fileDetails.type = 'application/x-subrip';
	}

	if (
		file.type !== 'video/mp4' &&
		file.type !== 'audio/mpeg' &&
		file.type !== 'audio/wav' &&
		file.type !== 'application/x-subrip' &&
		file.type !== 'image/jpeg' &&
		file.type !== 'image/png'
	) {
		appState.import.fileDetails.type = 'unknown';
		appState.import.warningMessage = 'file type not supported';
		appState.palettePage = 'import';
		appState.showPalette = true;
		return;
	}

	const info = await checkDroppedSource(file, appState.import.fileDetails.type);
	if (!info) return;

	if ('error' in info) {
		appState.import.fileDetails.type = 'unknown';
		appState.import.warningMessage = info.error ?? '';
		appState.palettePage = 'import';
		appState.showPalette = true;
		return;
	}

	appState.import.fileDetails.info = info;

	let newSource;
	if (info.type === 'video') newSource = await createVideoSource(file, info);
	if (info.type === 'image') newSource = await createImageSource(file, info);
	if (info.type === 'audio') newSource = await createAudioSource(file, info);
	if (info.type === 'srt') newSource = await createSrtSource(file, info);
	if (!newSource) return;

	if (handle) newSource.handle = handle;
	await projectManager.createSource(newSource);
};

export const relinkFile = async (file: File, sourceId: string) => {
	const source = getSourceFromId(sourceId);
	if (!source) return;

	if (source.type === 'video') await createVideoSource(file, source.info, source);
	// TODO: audio file re-link

	source.unlinked = false;
};

export const checkDroppedSource = async (
	file: File,
	fileType: string
): Promise<FileInfo | { error: string }> => {
	if (fileType === 'video/mp4') {
		const input = new Input({
			formats: ALL_FORMATS,
			source: new BlobSource(file)
		});

		const videoTrack = await input.getPrimaryVideoTrack();
		if (!videoTrack) return { error: 'No video track' };

		const codecSupported = await videoTrack.canDecode();
		if (!codecSupported) return { error: 'Codec is not supported' };

		const duration = await videoTrack.computeDuration();
		const stats = await videoTrack.computePacketStats(100);
		const frameRate = stats.averagePacketRate;

		return {
			type: 'video',
			codec: videoTrack.codec ?? '',
			resolution: { width: videoTrack.displayWidth, height: videoTrack.displayHeight },
			frameRate,
			duration
		};
	} else if (fileType === 'audio/mpeg' || fileType === 'audio/wav') {
		const input = new Input({
			formats: ALL_FORMATS,
			source: new BlobSource(file)
		});

		const audioTrack = await input.getPrimaryAudioTrack();
		if (!audioTrack) return { error: 'No audio track' };

		const codecSupported = await audioTrack.canDecode();
		if (!codecSupported) {
			return { error: 'Codec is not supported' };
		}

		const duration = await audioTrack.computeDuration();

		return {
			type: 'audio',
			codec: audioTrack.codec ?? '',
			sampleRate: audioTrack.sampleRate,
			channelCount: audioTrack.numberOfChannels,
			duration
		};
	} else if (fileType === 'application/x-subrip') {
		const result = await readFileAsText(file);
		const srtEntries = parseSrt(result);
		return {
			type: 'srt',
			duration: 30,
			entries: srtEntries.length
		};
	} else if (fileType === 'image/jpeg' || fileType === 'image/png') {
		const bitmap = await createImageBitmap(file);
		const width = bitmap.width;
		const height = bitmap.height;
		bitmap.close();
		return {
			type: 'image',
			format: fileType === 'image/jpeg' ? 'jpeg' : 'png',
			resolution: { width: width, height: height }
		};
	}
	return { error: 'File format is not supported' };
};

function timestampToFrames(timestamp: string, fps: number = 30): number {
	// Assumes format HH:MM:SS,mmm
	const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
	if (!match) return 0;

	const hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);
	const seconds = parseInt(match[3], 10);
	const ms = parseInt(match[4], 10);
	const totalMilliseconds = hours * 3600 * 1000 + minutes * 60 * 1000 + seconds * 1000 + ms;
	const totalSeconds = totalMilliseconds / 1000;

	return Math.round(totalSeconds * fps);
}

function parseSrt(srtContent: string): SrtEntry[] {
	// Convert all \r\n (Windows) and \r (Mac Classic) to \n.
	const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const blocks = normalizedContent.split(/\n\s*\n/g).filter((block) => block.trim() !== '');

	const entries: SrtEntry[] = [];

	// Group 1: Sequence number
	// Group 2: In-point timestamp
	// Group 3: Out-point timestamp
	// Group 4: Text content
	const blockRegex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*)/;

	for (const block of blocks) {
		const match = block.match(blockRegex);

		if (match && match.length >= 5) {
			const inPoint = timestampToFrames(match[2]);
			const outPoint = timestampToFrames(match[3]);
			// Clean the text by removing any trailing newlines/spaces
			const text = match[4].trim();

			if (text) {
				entries.push({
					inPoint: inPoint,
					outPoint: outPoint,
					text: text
				});
			}
		}
	}

	return entries;
}

const readFileAsText = (file: File) => {
	return new Promise<string>((resolve /*  reject */) => {
		const reader = new FileReader();
		reader.onload = () => {
			resolve(reader.result as string);
		};
		reader.onerror = () => {
			//reject(new Error('Error reading the file.'));
		};
		reader.readAsText(file);
	});
};

export const setSourceThumbnail = (sourceId: string, blob: Blob) => {
	const image = URL.createObjectURL(blob);
	for (const source of appState.sources) {
		if (source.id === sourceId) {
			source.thumbnail = image;
		}
	}
};

export const getSourceFromId = (id: string) => {
	let foundSource;
	for (const source of appState.sources) {
		if (source.id === id) {
			foundSource = source;
		}
	}
	return foundSource;
};

const createThumbnail = async (
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
	return await canvas.convertToBlob({ type: 'image/png' });
};
