import { appState } from '$lib/state.svelte';
import { Source } from './source';
import { createFile, MP4BoxBuffer } from 'mp4box';

export const createSource = async (file: File) => {
	//const videoSource = await coreSource.from<VideoSource>(url, { prefetch: false });

	const reader = new FileReader();

	reader.onload = function (e) {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!arrayBuffer) return;

		const mp4file = createFile();
		mp4file.onReady = (info) => {
			console.log(info);
		};
		arrayBuffer.fileStart = 0;
		mp4file.appendBuffer(arrayBuffer);
		mp4file.flush();
	};

	reader.readAsArrayBuffer(file);

	//appState.sources.push(new Source(url));
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
