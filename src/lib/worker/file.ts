import type { WorkerVideoSource } from '$lib/types';
import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from 'mediabunny';

export const loadFile = async (file: File, sourceId: string): Promise<WorkerVideoSource> => {
	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(file)
	});

	const videoTrack = await input.getPrimaryVideoTrack();
	if (!videoTrack) {
		throw new Error('No video track');
	}

	const videoConfig = await videoTrack.getDecoderConfig();
	if (!videoConfig) {
		throw new Error('No video config ');
	}

	const stats = await videoTrack.computePacketStats(100);
	const frameRate = stats.averagePacketRate;

	const encodedPacketSink = new EncodedPacketSink(videoTrack);

	const sink = new EncodedPacketSink(videoTrack);
	const startSample = await sink.getFirstPacket();
	const endSample = await sink.getPacket(60);

	if (!startSample || !endSample) throw new Error('Not enough samples');

	let i = 0;
	let largestKeyframeGap = 0;
	let currentKeyframeGap = 0;
	let previousKeyframeIndex = -1;
	for await (const packet of sink.packets(startSample, endSample)) {
		if (packet.type === 'key') {
			if (previousKeyframeIndex !== -1) {
				currentKeyframeGap = i - previousKeyframeIndex;
				if (currentKeyframeGap > largestKeyframeGap) {
					largestKeyframeGap = currentKeyframeGap;
				}
			}
			previousKeyframeIndex = i;
		}
		i++;
	}

	return {
		videoTrack,
		videoConfig,
		encodedPacketSink,
		id: sourceId,
		gap: largestKeyframeGap,
		height: videoTrack.codedHeight,
		width: videoTrack.codedWidth,
		frameRate
	};
};
