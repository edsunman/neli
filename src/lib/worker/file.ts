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
export const loadFile = async (
	file: File
): Promise<{ chunks: EncodedAudioChunk[]; config: VideoEncoderConfig }> => {
	let resolver: (value: { chunks: EncodedAudioChunk[]; config: VideoEncoderConfig }) => void;
	const promise = new Promise<{ chunks: EncodedAudioChunk[]; config: VideoEncoderConfig }>(
		(resolve) => {
			resolver = resolve;
		}
	);

	const chunks: EncodedVideoChunk[] = [];
	let mp4File: ISOFile | null = createFile();
	let config: VideoDecoderConfig;

	mp4File.onReady = (info) => {
		//console.log(info);

		config = {
			codec: info.videoTracks[0].codec.startsWith('vp08') ? 'vp8' : info.videoTracks[0].codec,
			codedHeight: info.videoTracks[0].track_height,
			codedWidth: info.videoTracks[0].track_width,
			description: getDescription(mp4File),
			optimizeForLatency: true
		};
	};
	mp4File.onSamples = (id, user, samples) => {
		for (const sample of samples) {
			const chunk = new EncodedVideoChunk({
				type: sample.is_sync ? 'key' : 'delta',
				timestamp: (1e6 * sample.cts) / sample.timescale,
				duration: (1e6 * sample.duration) / sample.timescale,
				data: sample.data!
			});
			chunks.push(chunk);
		}

		if (samples.length < 1000) {
			mp4File = null;
			//@ts-expect-error no idea ??
			resolver({ chunks, config });
		}
	};

	const reader = new FileReader();
	reader.onload = (e) => {
		const arrayBuffer = e.target?.result as MP4BoxBuffer;
		if (!mp4File || !arrayBuffer) return;
		arrayBuffer.fileStart = 0;
		mp4File.appendBuffer(arrayBuffer);
		mp4File.flush();
		mp4File.setExtractionOptions(1);
		mp4File.start();
	};
	reader.readAsArrayBuffer(file);

	return promise;
};

const getDescription = (file: ISOFile | null) => {
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
