import type { WorkerSource } from '$lib/types';
import {
	createFile,
	MP4BoxBuffer,
	DataStream,
	ISOFile,
	Endianness,
	VisualSampleEntry,
	MultiBufferStream
} from 'mp4box';

/** Load file and demux */
export const loadFile = async (file: File): Promise<WorkerSource> => {
	let resolver: (value: WorkerSource) => void;
	let decoding: 'audio' | 'video' = 'audio';
	const promise = new Promise<WorkerSource>((resolve) => {
		resolver = resolve;
	});

	const videoChunks: EncodedVideoChunk[] = [];
	const audioChunks: EncodedAudioChunk[] = [];
	let mp4File: ISOFile | null = createFile();
	let videoConfig: VideoDecoderConfig;
	let audioConfig: AudioDecoderConfig;

	mp4File.onReady = (info) => {
		//console.log(info);
		getAudioDesciption(mp4File);
		videoConfig = {
			codec: info.videoTracks[0].codec.startsWith('vp08') ? 'vp8' : info.videoTracks[0].codec,
			codedHeight: info.videoTracks[0].track_height,
			codedWidth: info.videoTracks[0].track_width,
			description: getVideoDescription(mp4File),
			optimizeForLatency: true
		};
		audioConfig = {
			codec: info.audioTracks[0].codec,
			sampleRate: info.audioTracks[0].audio?.sample_rate ?? 0,
			numberOfChannels: info.audioTracks[0].audio?.channel_count ?? 2,
			description: getAudioDesciption(mp4File)
		};
	};
	mp4File.onSamples = (id, user, samples) => {
		for (const sample of samples) {
			if (decoding === 'audio') {
				const chunk = new EncodedAudioChunk({
					type: sample.is_sync ? 'key' : 'delta',
					timestamp: (1e6 * sample.cts) / sample.timescale,
					duration: (1e6 * sample.duration) / sample.timescale,
					data: sample.data!
				});
				audioChunks.push(chunk);
			} else {
				const chunk = new EncodedVideoChunk({
					type: sample.is_sync ? 'key' : 'delta',
					timestamp: (1e6 * sample.cts) / sample.timescale,
					duration: (1e6 * sample.duration) / sample.timescale,
					data: sample.data!
				});
				videoChunks.push(chunk);
			}
		}

		if (samples.length < 1000) {
			if (decoding === 'audio') {
				decoding = 'video';
				mp4File!.setExtractionOptions(1);
				mp4File!.start();
			} else {
				mp4File = null;
				//@ts-expect-error videoConfig not happy
				resolver({ audioChunks, videoChunks, audioConfig, videoConfig });
			}
		}
	};

	const reader = new FileReader();
	reader.onload = (e) => {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!mp4File || !arrayBuffer) return;
		arrayBuffer.fileStart = 0;
		mp4File.appendBuffer(arrayBuffer);
		mp4File.flush();
		mp4File.setExtractionOptions(2);
		mp4File.start();
	};
	reader.readAsArrayBuffer(file);

	return promise;
};

const getVideoDescription = (file: ISOFile | null) => {
	if (!file) return;
	// TODO: don't hardcode this track number
	const trak = file.getTrackById(1);
	for (const entry of trak.mdia.minf.stbl.stsd.entries) {
		const e = entry as VisualSampleEntry;
		// @ts-expect-error avc1C or vpcC may exist
		const box = e.avcC || e.hvcC || entry.av1C || entry.vpcC;
		if (box) {
			const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
			box.write(stream as MultiBufferStream);
			return new Uint8Array(stream.buffer, 8); // Remove the box header.
		}
	}
	throw new Error('avcC, hvcC, vpcC, or av1C box not found');
};

const getAudioDesciption = (file: ISOFile | null) => {
	if (!file) return;
	const trak = file.getTrackById(2);
	const entry = trak.mdia.minf.stbl.stsd.entries[0];
	//@ts-expect-error esds does exist
	return entry.esds.esd.descs[0].descs[0].data;
};
