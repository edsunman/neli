import { sendFileToWorker } from '$lib/renderer/actions';
import { appState } from '$lib/state.svelte';
import { Source } from './source';
import { createFile, MP4BoxBuffer, type Movie } from 'mp4box';

export const createSource = async (file: File) => {
	//const videoSource = await coreSource.from<VideoSource>(url, { prefetch: false });

	const reader = new FileReader();
	let mp4info: Movie;

	reader.onload = function (e) {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!arrayBuffer) return;

		const mp4file = createFile();
		mp4file.onReady = (info) => {
			console.log(info);
			mp4info = info;

			appState.sources.push(new Source(mp4info, file));
			sendFileToWorker();
		};
		arrayBuffer.fileStart = 0;
		mp4file.appendBuffer(arrayBuffer);
		mp4file.flush();
	};

	reader.readAsArrayBuffer(file);
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
