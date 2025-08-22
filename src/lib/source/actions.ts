import { sendFileToWorker } from '$lib/worker/actions.svelte';
import { appState } from '$lib/state.svelte';
import { Source } from './source.svelte';
import { generateWaveformData } from '$lib/audio/actions';
import { Input, ALL_FORMATS, BlobSource, EncodedPacketSink } from 'mediabunny';
import type { FileInfo } from '$lib/types';

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
	}
	return { error: 'File format is not supported' };
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
