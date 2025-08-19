import type { WorkerSource } from '$lib/types';
import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from 'mediabunny';

export const loadFile = async (file: File, sourceId: string): Promise<WorkerSource | undefined> => {
	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(file)
	});

	const videoTrack = await input.getPrimaryVideoTrack();
	if (!videoTrack) return;

	const videoConfig = await videoTrack.getDecoderConfig();
	if (!videoConfig) return;

	const stats = await videoTrack.computePacketStats(100);
	const frameRate = stats.averagePacketRate;
	// 2 minute limit
	const maxSampleCount = frameRate * 120;

	const sink = new EncodedPacketSink(videoTrack);
	const videoChunks: EncodedVideoChunk[] = [];

	let i = 0;
	let largestKeyframeGap = 0;
	let currentKeyframeGap = 0;
	let previousKeyframeIndex = -1;
	for await (const packet of sink.packets()) {
		if (packet.type === 'key') {
			if (previousKeyframeIndex !== -1) {
				currentKeyframeGap = i - previousKeyframeIndex;
				if (currentKeyframeGap > largestKeyframeGap) {
					largestKeyframeGap = currentKeyframeGap;
				}
			}
			previousKeyframeIndex = i;
		}
		videoChunks.push(packet.toEncodedVideoChunk());
		i++;
		if (i >= maxSampleCount) break;
	}

	return { videoChunks, videoConfig, id: sourceId, gap: largestKeyframeGap };
};
