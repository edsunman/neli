import { sendFileToWorker } from '$lib/worker/actions';
import { appState } from '$lib/state.svelte';
import { Source } from './source';
import { createFile, MP4BoxBuffer, type Movie } from 'mp4box';

export const createVideoSource = async (file: File) => {
	const reader = new FileReader();
	let mp4info: Movie;

	const chunkSize = 1024 * 1024; // 1 MB chunks
	let offset = 0;
	let foundInfo = false;
	//let loop = 0;

	const mp4file = createFile();
	mp4file.onReady = (info) => {
		console.log(info);
		if (info.videoTracks.length < 1) {
			console.warn('no video track');
			return;
		}
		foundInfo = true;
		mp4info = info;
		const newSource = new Source('video', mp4info, file);
		appState.sources.push(newSource);
		sendFileToWorker(newSource);
	};

	reader.onload = function (e) {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!arrayBuffer) return;

		arrayBuffer.fileStart = offset;
		mp4file.appendBuffer(arrayBuffer);

		offset += arrayBuffer.byteLength;
		//loop++;

		if (offset < file.size && !foundInfo) {
			readNextChunk();
		} else {
			// we may need to store the loop to tell the worker where the info container is
			mp4file.flush();
		}
	};

	function readNextChunk() {
		const slice = file.slice(offset, offset + chunkSize);
		reader.readAsArrayBuffer(slice); // Reads only the slice into memory
	}

	readNextChunk();
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
