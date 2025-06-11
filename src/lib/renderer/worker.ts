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

const chunks: EncodedVideoChunk[] = [];
let renderer: WebGPURenderer | null = null;
let decoder: VideoDecoder | null = null;
let mp4file: ISOFile | null = null;
let file: File | null = null;
let targetFrame = 0;
let selectedFrameTimestamp = 0;

let frameQueue = []; // Holds decoded VideoFrames waiting to be rendered
let encodedChunkBuffer: EncodedVideoChunk[] = []; // Holds EncodedVideoChunks ready to be fed to the decoder
let isFeedingPaused = false;

let seeking = false;

self.addEventListener('message', async function (e) {
	//console.info(`Worker message: ${JSON.stringify(e.data)}`);

	switch (e.data.command) {
		case 'initialize':
			{
				renderer = new WebGPURenderer(e.data.canvas);
				decoder = new VideoDecoder({
					output(frame) {
						//console.log(frame.timestamp);
						//frameQueue.push(frame);
						// As soon as a frame is outputted, try to render it and potentially resume feeding
						//renderNextFrame(); // Your function to draw the frame

						// After a frame is processed (and its memory released via videoFrame.close()),
						// we can check if we should resume feeding.
						frameQueue.push(frame);
						if (frame.timestamp === selectedFrameTimestamp) {
							renderer?.draw(frame);
							seeking = false;
							//frame.close();
						} else {
							frame.close();
						}

						if (isFeedingPaused && /* frameQueue.length < 10 &&  */ decoder!.decodeQueueSize < 10) {
							isFeedingPaused = false;
							//console.log('Decoder backpressure: Resuming feeding.');
							feedDecoder();
						}
					},
					error(e) {
						console.log('encoder error', e);
					}
				});
			}
			break;
		case 'load-file':
			{
				mp4file = createFile();
				mp4file.onReady = (info) => {
					console.log(info);

					if (!decoder) return;
					decoder.configure({
						codec: info.videoTracks[0].codec.startsWith('vp08') ? 'vp8' : info.videoTracks[0].codec,
						codedHeight: info.videoTracks[0].track_height,
						codedWidth: info.videoTracks[0].track_width,
						description: getDescription(mp4file),
						optimizeForLatency: true
					});
				};
				mp4file.onSamples = (id, user, samples) => {
					//console.log(`adding new ${samples.length} samples `);
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
						// finished with samples so clean up
						mp4file = null;

						if (!decoder) return;
						decoder.flush();
						for (let i = 0; i < 30; i++) {
							decoder.decode(chunks[i]);
						}
					}
				};

				const reader = new FileReader();
				reader.onload = function (e) {
					const arrayBuffer = e.target?.result as MP4BoxBuffer;
					if (!arrayBuffer) return;
					//console.log(arrayBuffer);
					if (!mp4file) return;
					arrayBuffer.fileStart = 0;
					mp4file.appendBuffer(arrayBuffer);
					mp4file.flush();
					mp4file.setExtractionOptions(1);
					mp4file.start();
				};
				file = e.data.file as File;

				reader.readAsArrayBuffer(file);
			}
			break;
		case 'seek':
			{
				if (!decoder) return;
				if (seeking) {
					//console.log('still seeking');
					return;
				}

				seeking = true;
				decoder.flush();
				targetFrame = Math.floor(e.data.targetFrame * 33333.3333333) + 33333 / 2;
				console.log(`target frame is ${targetFrame}`);

				let targetFrameIndex = 0;
				let keyFrameIndex = 0;
				let scanForKeyframe = false;
				for (let i = chunks.length - 1; i >= 0; i--) {
					if (!scanForKeyframe && chunks[i].timestamp < targetFrame) {
						targetFrameIndex = i;
						selectedFrameTimestamp = chunks[i].timestamp;
						scanForKeyframe = true;
					}
					if (scanForKeyframe) {
						if (chunks[i].type === 'key') {
							keyFrameIndex = i;
							break;
						}
					}
				}

				encodedChunkBuffer = [];

				frameQueue = [];

				for (let i = keyFrameIndex; i < targetFrameIndex + 10; i++) {
					encodedChunkBuffer.push(chunks[i]);
				}

				feedDecoder();
			}
			break;
	}
});

const feedDecoder = async () => {
	if (isFeedingPaused || !decoder || decoder.state !== 'configured') {
		return; // Don't feed if paused or not configured
	}

	// Check if we're hitting our backpressure limits
	// 1. Too many decoded frames waiting to be rendered
	// 2. Too many chunks already sent to the decoder, but not yet outputted
	if (/* frameQueue.length >= 10 ||  */ decoder.decodeQueueSize >= 10) {
		isFeedingPaused = true;
		/* console.warn(
			'Decoder backpressure: Pausing feeding. frameQueue:',
			frameQueue.length,
			'decodeQueueSize:',
			decoder.decodeQueueSize
		); */
		return; // Stop feeding for now
	}

	// If we have chunks in our buffer and not paused, send them
	if (encodedChunkBuffer.length > 0) {
		const chunk = encodedChunkBuffer.shift(); // Get the next chunk
		if (!chunk) return;
		try {
			decoder.decode(chunk);
			// Successfully sent, try to send more if conditions allow
			feedDecoder();
		} catch (e) {
			console.error('Error decoding chunk:', e);
			// Handle fatal errors or corrupted chunks
			//  videoDecoder.close(); // Consider closing on fatal error
		}
	} else {
		//console.log('no more chunks');
		seeking = false;
		// No more chunks in the buffer to feed right now.
		// This might be the end of the video segment, or we're waiting for more data from network/file.
	}
};

const getDescription = (file: ISOFile | null) => {
	if (!file) return;
	// TODO: dont hardcode this track number
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
