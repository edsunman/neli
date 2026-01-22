import { sendFileToWorker } from '$lib/worker/actions.svelte';
import { appState } from '$lib/state.svelte';
import { Source } from './source.svelte';
import { generateWaveformData } from '$lib/audio/actions';
import { Input, ALL_FORMATS, BlobSource, EncodedPacketSink, AudioSampleSink } from 'mediabunny';
import type { FileInfo, SourceType, SrtEntry } from '$lib/types';

export const createSource = (type: SourceType, info: FileInfo, file?: File) => {
	const newSource = new Source(type, info);
	newSource.id = Math.random().toString(16).slice(2);

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

	const sourceCount = appState.sources.filter((source) => !source.preset).length;

	let folderId = 0;
	for (let i = 0; i < sourceCount / 7; i++) {
		folderId++;
		appState.sourceFolders.push({ id: folderId });
	}

	let i = 0;
	for (const source of appState.sources) {
		if (source.preset) {
			source.folderId = 0;
			continue;
		}
		source.folderId = Math.floor(i / 7) + 1;
		i++;
	}

	appState.selectedSourceFolder = folderId;
};

export const createVideoSource = async (file: File, info: FileInfo) => {
	const newSource = createSource('video', info, file);

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

	sendFileToWorker(newSource);
	await generateWaveformData(newSource);
	return newSource.id;
};

export const createImageSource = async (file: File, info: FileInfo) => {
	const newSource = createSource('image', info, file);
	newSource.info = info;
	sendFileToWorker(newSource);
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

	if (!audioTrack || !audioConfig) return;

	newSource.sink = new EncodedPacketSink(audioTrack);
	newSource.sampleSink = new AudioSampleSink(audioTrack);
	newSource.audioConfig = audioConfig;

	await generateWaveformData(newSource);
	return newSource.id;
};

export const createSrtSource = async (file: File, info: FileInfo) => {
	const result = await readFileAsText(file);
	const srtEntries = parseSrt(result);
	const newSource = createSource('srt', info, file); //new Source('srt', file);
	newSource.srtEntries = srtEntries;
};

export const processFile = async (file: File) => {
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

	/* if (file.size > 1e9) {
		appState.import.fileDetails.type = 'unknown';
		appState.import.warningMessage = 'file exceeds 1GB size limit';
		appState.palettePage = 'import';
		appState.showPalette = true;
		return;
	} */

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

	/* 	if (info.type === 'video' && info.duration > 120) {
		appState.import.warningMessage = 'File duration is currently limited to 2 minutes';
		appState.palettePage = 'import';
		appState.showPalette = true;
	} */

	appState.importSuccessCallback = (source: Source, gap: number) => {
		appState.import.thumbnail = source.thumbnail;
		if (gap > 70 && appState.import.warningMessage === '') {
			appState.import.warningMessage = `this video has a large gap between keyframes (${gap}) which may result in poor playback performance`;
			appState.palettePage = 'import';
			appState.showPalette = true;
		}
	};

	if (info.type === 'video') await createVideoSource(file, info);
	if (info.type === 'image') await createImageSource(file, info);
	if (info.type === 'audio') await createAudioSource(file, info);
	if (info.type === 'srt') await createSrtSource(file, info);
};

export const checkDroppedSource = async (
	file: File,
	fileType: string
): Promise<FileInfo | { error: string }> => {
	//console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

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

export const setSourceThumbnail = (sourceId: string, image: string, gap: number) => {
	for (const source of appState.sources) {
		if (source.id === sourceId) {
			source.thumbnail = image;
			appState.importSuccessCallback(source, gap);
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
