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
export const loadFile = async (file: File, sourceId: number): Promise<WorkerSource> => {
	let resolver: (value: WorkerSource) => void;
	const promise = new Promise<WorkerSource>((resolve) => {
		resolver = resolve;
	});

	const videoChunks: EncodedVideoChunk[] = [];
	let mp4File: ISOFile | null = createFile();
	let videoConfig: VideoDecoderConfig | undefined;
	let readSampleCount = 0;
	let maxSampleCount = 0;

	let largestKeyframeGap = 0;
	let currentKeyframeGap = 0;
	let previousKeyframeIndex = -1;

	mp4File.onReady = (info) => {
		const trackInfo = info?.videoTracks[0];
		videoConfig = {
			codec: trackInfo.codec.startsWith('vp08') ? 'vp8' : trackInfo.codec,
			codedHeight: trackInfo.track_height,
			codedWidth: trackInfo.track_width,
			description: getVideoDescription(mp4File, trackInfo.id),
			optimizeForLatency: true
		};
		const frameRate = trackInfo.nb_samples / (trackInfo.duration / trackInfo.timescale);
		maxSampleCount = frameRate * 120; // Limit to first 2 mins

		mp4File!.setExtractionOptions(info.videoTracks[0].id);
		mp4File!.start();
	};
	mp4File.onSamples = (id, user, samples) => {
		for (const sample of samples) {
			// Check if the current sample is a keyframe
			if (sample.is_sync) {
				// This is a keyframe, so calculate the gap
				if (previousKeyframeIndex !== -1) {
					// The gap is the number of samples between the previous keyframe and this one
					currentKeyframeGap = readSampleCount - previousKeyframeIndex;

					// Update the largest gap if the current one is bigger
					if (currentKeyframeGap > largestKeyframeGap) {
						largestKeyframeGap = currentKeyframeGap;
					}
				}
				// Update the index of the last keyframe found
				previousKeyframeIndex = readSampleCount;
			}
			if (readSampleCount > maxSampleCount) continue;
			const chunk = new EncodedVideoChunk({
				type: sample.is_sync ? 'key' : 'delta',
				timestamp: (1e6 * sample.cts) / sample.timescale,
				duration: (1e6 * sample.duration) / sample.timescale,
				data: sample.data!
			});
			videoChunks.push(chunk);
			readSampleCount++;
		}

		// apply time limit
		if (samples.length < 1000 || readSampleCount > maxSampleCount) {
			mp4File!.stop();
			mp4File = null;
			//@ts-expect-error videoConfig not happy
			resolver({ videoChunks, videoConfig, id: sourceId, gap: largestKeyframeGap });
		}
	};

	const reader = new FileReader();
	reader.onload = (e) => {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!mp4File || !arrayBuffer) return;
		arrayBuffer.fileStart = 0;
		mp4File.appendBuffer(arrayBuffer);
	};
	reader.readAsArrayBuffer(file);

	return promise;
};

const getVideoDescription = (file: ISOFile | null, id: number) => {
	if (!file) return;
	const trak = file.getTrackById(id);
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
