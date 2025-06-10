import {
	createFile,
	MP4BoxBuffer,
	DataStream,
	ISOFile,
	Endianness,
	VisualSampleEntry,
	MultiBufferStream
} from 'mp4box';
import { WebGPURenderer } from './renderer';

console.info('Worker started');

const chunks: EncodedVideoChunk[] = [];
let renderer: WebGPURenderer | null = null;

self.addEventListener('message', async function (e) {
	console.info(`Worker message: ${JSON.stringify(e.data)}`);

	switch (e.data.command) {
		case 'initialize':
			{
				renderer = new WebGPURenderer(e.data.canvas);
				console.log(renderer);
			}
			break;
		case 'decode':
			{
				console.log(e.data.file);

				const reader = new FileReader();
				reader.onload = function (e) {
					const arrayBuffer = e.target?.result as MP4BoxBuffer;
					if (!arrayBuffer) return;

					const mp4file = createFile();
					mp4file.onReady = () => {
						console.log('mp4 file loaded');
					};
					mp4file.onSamples = (id, user, samples) => {
						console.log(`adding new ${samples.length} samples `);
						let i = 0;
						for (const sample of samples) {
							if (i > 30) break;
							i++;
							//this.samples.push(sample);
							const chunk = new EncodedVideoChunk({
								type: sample.is_sync ? 'key' : 'delta',
								timestamp: (1e6 * sample.cts) / sample.timescale,
								duration: (1e6 * sample.duration) / sample.timescale,
								data: sample.data!
							});
							chunks.push(chunk);
						}

						const decoder = new VideoDecoder({
							output(frame) {
								console.log(frame);
								if (frame.timestamp === 0) {
									renderer?.draw(frame);
									console.log(frame);
								} else {
									frame.close();
								}
							},
							error(e) {
								console.log('encoder error', e);
							}
						});
						//console.log(getDescription(mp4file));
						decoder.configure({
							codec: 'avc1.4d4029',
							codedHeight: 1080,
							codedWidth: 1920,
							description: getDescription(mp4file)
						});
						decoder.flush();
						for (let i = 0; i < 10; i++) {
							decoder.decode(chunks[i]);
						}
						decoder.decode(chunks[0]);
					};

					arrayBuffer.fileStart = 0;
					mp4file.appendBuffer(arrayBuffer);
					mp4file.flush();
					mp4file.setExtractionOptions(1);
					mp4file.start();
				};
				const file = e.data.file as File;
				//console.log('file', file);
				reader.readAsArrayBuffer(file);
			}
			break;
	}
});

const getDescription = (file: ISOFile) => {
	// TODO: dont hardcode this track number
	const trak = file.getTrackById(1);
	for (const entry of trak.mdia.minf.stbl.stsd.entries) {
		const e = entry as VisualSampleEntry;
		const box = e.avcC || e.hvcC;
		if (box) {
			const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
			box.write(stream as MultiBufferStream);
			return new Uint8Array(stream.buffer, 8); // Remove the box header.
		}
	}
	throw new Error('avcC, hvcC, vpcC, or av1C box not found');
};
