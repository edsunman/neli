import { sendFileToWorker } from '$lib/worker/actions.svelte';
import { appState } from '$lib/state.svelte';
import { Source } from './source.svelte';
import { createFile, ISOFile, MP4BoxBuffer, type Movie } from 'mp4box';
import { generateWaveformData } from '$lib/audio/actions';

export const checkDroppedSource = (file: File) => {
	let resolver: (value: Movie) => void;
	const promise = new Promise<Movie>((resolve) => {
		resolver = resolve;
	});
	console.log(`Processing file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);
	console.log(file.type);
	if (file.type === 'video/mp4') {
		const reader = new FileReader();

		let mp4file: ISOFile<unknown, unknown> | null = createFile();
		mp4file.onReady = (info) => {
			if (info.videoTracks.length < 1) {
				console.warn('no video track');
				mp4file = null;
				return;
			}

			// TODO: check codec is suported by VideoDecoder
			mp4file = null;
			resolver(info);
		};
		reader.onload = function (e) {
			const arrayBuffer = e.target?.result as MP4BoxBuffer;
			if (!arrayBuffer) return;

			arrayBuffer.fileStart = 0;
			mp4file!.appendBuffer(arrayBuffer);
		};

		reader.readAsArrayBuffer(file);
		return promise;
	}
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
	thumbnailCallback: (source: Source, gap: number) => void
) => {
	let resolve: (value: string) => void;
	const promise = new Promise<string>((res) => {
		resolve = res;
	});

	const reader = new FileReader();
	let mp4info: Movie;

	let audioConfig: AudioDecoderConfig;
	const audioChunks: EncodedAudioChunk[] = [];
	let readSampleCount = 0;
	let maxSampleCount = 0;

	let mp4file: ISOFile<unknown, unknown> | null = createFile();
	mp4file.onReady = (info) => {
		console.log(info);
		if (info.videoTracks.length < 1) {
			console.warn('no video track');
			return;
		}
		// TODO: check codec is suported by VideoDecoder
		mp4info = info;
		const trackInfo = info.audioTracks[0];

		if (trackInfo) {
			audioConfig = {
				codec: trackInfo.codec,
				sampleRate: trackInfo.audio?.sample_rate ?? 0,
				numberOfChannels: trackInfo.audio?.channel_count ?? 2,
				description: getAudioDesciption(mp4file, info.audioTracks[0].id)
			};
			const frameRate = trackInfo.nb_samples / (trackInfo.duration / trackInfo.timescale);
			maxSampleCount = frameRate * 120; // Limit to first 2 mins
			mp4file!.setExtractionOptions(info.audioTracks[0].id);
			mp4file!.start();
		} else {
			console.warn('no audio track');
			mp4file!.stop();
			mp4file = null;
			const newSource = new Source('video', mp4info, file);
			appState.sources.push(newSource);
			appState.importSuccessCallback = thumbnailCallback;
			sendFileToWorker(newSource);
			resolve(newSource.id);
		}
	};
	mp4file.onSamples = async (id, user, samples) => {
		for (const sample of samples) {
			if (readSampleCount > maxSampleCount) continue;
			const chunk = new EncodedAudioChunk({
				type: sample.is_sync ? 'key' : 'delta',
				timestamp: (1e6 * sample.cts) / sample.timescale,
				duration: (1e6 * sample.duration) / sample.timescale,
				data: sample.data!
			});
			audioChunks.push(chunk);
			readSampleCount++;
		}

		if (samples.length < 1000 || readSampleCount > maxSampleCount) {
			mp4file!.stop();
			mp4file = null;
			const newSource = new Source('video', mp4info, file, audioChunks, audioConfig);
			appState.sources.push(newSource);
			appState.importSuccessCallback = thumbnailCallback;
			sendFileToWorker(newSource);
			await generateWaveformData(newSource);
			resolve(newSource.id);
		}
	};

	reader.onload = function (e) {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!arrayBuffer) return;
		arrayBuffer.fileStart = 0;
		mp4file!.appendBuffer(arrayBuffer);
	};

	reader.readAsArrayBuffer(file);

	return promise;
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

const getAudioDesciption = (file: ISOFile | null, id: number) => {
	if (!file) return;
	const trak = file.getTrackById(id);
	const entry = trak.mdia.minf.stbl.stsd.entries[0];
	//@ts-expect-error esds does exist
	return entry.esds.esd.descs[0].descs[0].data;
};
