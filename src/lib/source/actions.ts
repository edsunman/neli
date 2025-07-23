import { sendFileToWorker } from '$lib/worker/actions';
import { appState, audioDecoder } from '$lib/state.svelte';
import { Source } from './source';
import { createFile, ISOFile, MP4BoxBuffer, type Movie } from 'mp4box';

export const createVideoSource = async (file: File) => {
	const reader = new FileReader();
	let mp4info: Movie;

	const chunkSize = 1024 * 1024; // 1 MB chunks
	let offset = 0;
	let foundInfo = false;
	let audioConfig: AudioEncoderConfig;
	const audioChunks: EncodedAudioChunk[] = [];
	//let loop = 0;

	let mp4file = createFile();
	mp4file.onReady = (info) => {
		console.log(info);
		if (info.videoTracks.length < 1) {
			console.warn('no video track');
			return;
		}
		// TODO: check codec is suported by VideoDecoder
		foundInfo = true;
		mp4info = info;

		audioConfig = {
			codec: info.audioTracks[0].codec,
			sampleRate: info.audioTracks[0].audio?.sample_rate ?? 0,
			numberOfChannels: info.audioTracks[0].audio?.channel_count ?? 2,
			description: getAudioDesciption(mp4file, info.audioTracks[0].id)
		};
		console.log(audioConfig);
		mp4file.setExtractionOptions(info.audioTracks[0].id);
		mp4file.start();

		//const newSource = new Source('video', mp4info, file, audioConfig);
		//appState.sources.push(newSource);
		//sendFileToWorker(newSource);
	};
	mp4file.onSamples = (id, user, samples) => {
		//console.log(samples);
		for (const sample of samples) {
			const chunk = new EncodedAudioChunk({
				type: sample.is_sync ? 'key' : 'delta',
				timestamp: (1e6 * sample.cts) / sample.timescale,
				duration: (1e6 * sample.duration) / sample.timescale,
				data: sample.data!
			});
			audioChunks.push(chunk);
		}

		if (samples.length < 1000) {
			mp4file = null;
			const newSource = new Source('video', mp4info, file, audioChunks, audioConfig);
			appState.sources.push(newSource);
			sendFileToWorker(newSource);
			audioDecoder.setup(audioConfig, audioChunks);
		}
	};

	reader.onload = function (e) {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!arrayBuffer) return;

		arrayBuffer.fileStart = 0;
		mp4file.appendBuffer(arrayBuffer);

		/* 		offset += arrayBuffer.byteLength;
		//loop++;

		if (offset < file.size && !foundInfo) {
			readNextChunk();
		} else {
			// we may need to store the loop to tell the worker where the info container is
			mp4file.flush();
		} */
	};

	reader.readAsArrayBuffer(file);

	/* 	function readNextChunk() {
		const slice = file.slice(offset, offset + chunkSize);
		reader.readAsArrayBuffer(slice); // Reads only the slice into memory
	}

	readNextChunk(); */
};

export const createTextSource = () => {
	appState.sources.push(new Source('text'));
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
