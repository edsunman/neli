import { sendFileToWorker } from '$lib/worker/actions.svelte';
import { appState } from '$lib/state.svelte';
import { Source } from './source.svelte';
import { generateWaveformData } from '$lib/audio/actions';
import { Input, ALL_FORMATS, BlobSource, EncodedPacketSink } from 'mediabunny';
import type { FileInfo, SrtEntry } from '$lib/types';

export const checkDroppedSource = async (file: File): Promise<FileInfo> => {
	console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);
	console.log(file.type);
	if (file.type === 'video/mp4') {
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
	} else if (file.type === 'audio/mpeg' || file.type === 'audio/wav') {
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
	} else if (file.type === 'application/x-subrip') {
		const result = await readFileAsText(file);
		const srtEntries = parseSrt(result);
		return {
			type: 'srt',
			duration: 30,
			entries: srtEntries.length
		};
	}
	return { error: 'File format is not supported' };
};

function timestampToFrames(timestamp: string, fps: number = 30): number {
	// Regex to extract hours, minutes, seconds, and milliseconds
	// Assumes format HH:MM:SS,mmm
	const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);

	if (!match) {
		console.error(`Invalid timestamp format: ${timestamp}`);
		return 0;
	}

	// Extract matched groups
	const hours = parseInt(match[1], 10);
	const minutes = parseInt(match[2], 10);
	const seconds = parseInt(match[3], 10);
	const milliseconds = parseInt(match[4], 10);

	// 1. Convert everything to total milliseconds
	const totalMilliseconds =
		hours * 3600 * 1000 + minutes * 60 * 1000 + seconds * 1000 + milliseconds;

	// 2. Convert milliseconds to seconds
	const totalSeconds = totalMilliseconds / 1000;

	// 3. Convert seconds to frames and round to the nearest whole frame
	const frameNumber = Math.round(totalSeconds * fps);

	return frameNumber;
}

function parseSrt(srtContent: string): SrtEntry[] {
	// 1. Normalize Newlines: Convert all \r\n (Windows) and \r (Mac Classic) to \n.
	const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	// 2. Split the content into individual subtitle blocks.
	// SRT blocks are typically separated by two newlines, and the file ends with newlines.
	// The first block is usually empty or contains file-specific header info, so we discard it.
	const blocks = normalizedContent.split(/\n\s*\n/g).filter((block) => block.trim() !== '');

	const entries: SrtEntry[] = [];

	// Regex to extract time and text from a *single block*
	// This is simpler and less prone to issues than a multi-block regex.
	// Group 1: Sequence number (e.g., 1) - Often unused but good for verification.
	// Group 2: In-point timestamp
	// Group 3: Out-point timestamp
	// Group 4: Text content (everything after the time line)
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

export const createVideoSource = async (
	file: File,
	thumbnailCallback: (source: Source, gap: number) => void,
	durationSeconds: number,
	frameRate: number,
	resolution: { height: number; width: number }
) => {
	const maxFrameCount = frameRate * 120;
	const newSource = new Source('video', file);
	newSource.frameRate = frameRate;
	const durationInFrames = Math.floor(durationSeconds * frameRate);
	newSource.duration = durationInFrames > maxFrameCount ? maxFrameCount : durationInFrames;
	newSource.height = resolution.height;
	newSource.width = resolution.width;

	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(file)
	});

	const audioTrack = await input.getPrimaryAudioTrack();
	const audioConfig = await audioTrack?.getDecoderConfig();

	if (audioTrack && audioConfig) {
		// file has audio track
		const sink = new EncodedPacketSink(audioTrack);
		const audioChunks: EncodedAudioChunk[] = [];

		let duration = 0;
		for await (const packet of sink.packets()) {
			duration += packet.duration;
			audioChunks.push(packet.toEncodedAudioChunk());
			if (duration > 120) break;
		}

		newSource.audioChunks = audioChunks;
		newSource.audioConfig = audioConfig;
	}

	appState.sources.push(newSource);
	appState.importSuccessCallback = thumbnailCallback;
	sendFileToWorker(newSource);
	await generateWaveformData(newSource);
	return newSource.id;
};

export const createAudioSource = async (file: File, durationSeconds: number) => {
	const maxFrameCount = 30 * 120;
	const newSource = new Source('audio', file);
	const durationInFrames = Math.floor(durationSeconds * 30);
	newSource.duration = durationInFrames > maxFrameCount ? maxFrameCount : durationInFrames;

	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(file)
	});

	const audioTrack = await input.getPrimaryAudioTrack();
	const audioConfig = await audioTrack?.getDecoderConfig();

	if (!audioTrack || !audioConfig) return;

	const sink = new EncodedPacketSink(audioTrack);
	const audioChunks: EncodedAudioChunk[] = [];

	let duration = 0;
	for await (const packet of sink.packets()) {
		duration += packet.duration;
		audioChunks.push(packet.toEncodedAudioChunk());
		if (duration > 120) break;
	}

	newSource.audioChunks = audioChunks;
	newSource.audioConfig = audioConfig;

	appState.sources.push(newSource);

	await generateWaveformData(newSource);
	return newSource.id;
};

export const createSrtSource = async (file: File) => {
	const result = await readFileAsText(file);
	const srtEntries = parseSrt(result);
	const newSource = new Source('srt', file);
	newSource.srtEntries = srtEntries;
	appState.sources.push(newSource);
};

export const createTextSource = () => {
	appState.sources.push(new Source('text'));
};

export const createTestSource = () => {
	appState.sources.push(new Source('test'));
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
