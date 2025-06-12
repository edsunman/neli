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

const DEBUG_QUEUES = false;

const chunks: EncodedVideoChunk[] = [];
let renderer: WebGPURenderer | null = null;
let decoder: VideoDecoder | null = null;
let mp4file: ISOFile | null = null;
let file: File | null = null;
let targetFrame = 0;
let selectedFrameTimestamp = 0;
let playing = false;
let feedMoreFrames = false;
let frameQueue: VideoFrame[] = []; // Holds decoded VideoFrames waiting to be rendered
let encodedChunkBuffer: EncodedVideoChunk[] = []; // Holds EncodedVideoChunks ready to be fed to the decoder
let isFeedingPaused = false;
let lastChunkIndex = 0;

let seeking = false;

self.addEventListener('message', async function (e) {
	//console.info(`Worker message: ${JSON.stringify(e.data)}`);

	switch (e.data.command) {
		case 'initialize':
			{
				renderer = new WebGPURenderer(e.data.canvas);
				decoder = new VideoDecoder({
					output(frame) {
						if (playing) {
							//frameQueue.push(frame);
							//console.log(frame);
							if (feedMoreFrames) {
								frameQueue.push(frame);
							} else if (frame.timestamp === selectedFrameTimestamp) {
								renderer?.draw(frame);
								feedMoreFrames = true;
								//	console.log('drawn start');
							} else {
								frame.close();
							}
						} else {
							//frameQueue.push(frame);
							if (frame.timestamp === selectedFrameTimestamp) {
								renderer?.draw(frame);
								seeking = false;
								//frame.close();
							} else {
								frame.close();
							}
						}

						if (isFeedingPaused && /* frameQueue.length < 10 &&  */ decoder!.decodeQueueSize < 3) {
							isFeedingPaused = false;
							if (DEBUG_QUEUES) console.log('Decoder backpressure: Resuming feeding.', playing);
							feedDecoder();
						}
						if (DEBUG_QUEUES) console.log('Decoder queue size: ', decoder!.decodeQueueSize);
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
		case 'play':
			{
				playing = true;
				frameQueue = [];
				encodedChunkBuffer = [];

				let firstRAFTimestamp: number | null = null;
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

				for (let i = keyFrameIndex; i < targetFrameIndex + 10; i++) {
					encodedChunkBuffer.push(chunks[i]);
					lastChunkIndex = i;
				}

				feedDecoder();

				const loop = (rafTimestamp: number) => {
					if (!playing) return;
					//console.log(rafTimestamp);
					if (feedMoreFrames) {
						if (firstRAFTimestamp === null) {
							firstRAFTimestamp = rafTimestamp;
						}

						const elapsedTimeMs = rafTimestamp - firstRAFTimestamp;
						const frameTime = Math.floor(elapsedTimeMs * 1000) + selectedFrameTimestamp;

						if (DEBUG_QUEUES) console.log('-- new loop, frame queue length ', frameQueue.length);
						//	console.log('chunk buffer ', encodedChunkBuffer.length);

						let minTimeDelta = Infinity;
						let frameIndex = -1;
						for (let i = 0; i < frameQueue.length; i++) {
							const time_delta = Math.abs(frameTime - frameQueue[i].timestamp);
							if (time_delta < minTimeDelta) {
								minTimeDelta = time_delta;
								frameIndex = i;
								//selectedFrameTimestamp = chunks[i].timestamp;
							} else {
								break;
							}
						}

						for (let i = 0; i < frameIndex; i++) {
							/* const staleFrame =  */ frameQueue.shift();
							//console.log('stale frame was closed: ', staleFrame?.format);
							//staleFrame?.close();
						}

						const chosenFrame = frameQueue[0];
						//lastFramePlayed = chosenFrame;

						if (chosenFrame && chosenFrame.format) {
							if (DEBUG_QUEUES)
								console.log(
									'Sending to render. Frame time delta = %dms (%d vs %d)',
									minTimeDelta / 1000,
									frameTime,
									chosenFrame.timestamp
								);
							//console.log(chosenFrame);
							targetFrame = frameQueue[0].timestamp;
							renderer?.draw(chosenFrame);
						}

						if (encodedChunkBuffer.length < 5) {
							if (DEBUG_QUEUES)
								console.log('fill chunk buffer starting with index ', lastChunkIndex + 1);

							for (let i = lastChunkIndex + 1, j = 0; j < 10; i++, j++) {
								//	console.log('pushing chunk ', i);
								encodedChunkBuffer.push(chunks[i]);
								lastChunkIndex = i;
								//c.push(chunks[i]);
							}

							feedDecoder();
						}
					}

					self.requestAnimationFrame(loop);
				};
				self.requestAnimationFrame(loop);
			}
			break;

			break;
		case 'pause':
			playing = false;
			feedMoreFrames = false;
			isFeedingPaused = false;
			//console.log('Paused', JSON.stringify(frameQueue));
			if (DEBUG_QUEUES) console.log('Paused. Frames left in queue:', frameQueue.length);

			for (let i = 0; i < frameQueue.length; i++) {
				//const staleFrame = frameQueue.shift();
				frameQueue[i].close();
				if (DEBUG_QUEUES) console.log('Closed frame: ', frameQueue[i]);
				//console.log('closed', staleFrame);
				//	staleFrame?.close();
			}
			frameQueue = [];

			break;
		case 'seek':
			{
				if (!decoder) return;
				if (seeking) {
					console.log('still seeking');
					return;
				}

				seeking = true;

				targetFrame = Math.floor(e.data.targetFrame * 33333.3333333) + 33333 / 2;

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
				for (let i = keyFrameIndex; i < targetFrameIndex + 10; i++) {
					encodedChunkBuffer.push(chunks[i]);
					lastChunkIndex = i;
				}

				isFeedingPaused = false;
				feedDecoder();
			}
			break;
	}
});

const feedDecoder = () => {
	if (isFeedingPaused || !decoder || decoder.state !== 'configured') {
		return; // Don't feed if paused or not configured
	}
	//console.log('Queue size: ', decoder.decodeQueueSize);
	// Check if we're hitting our backpressure limits
	// 1. Too many decoded frames waiting to be rendered
	// 2. Too many chunks already sent to the decoder, but not yet outputted
	if (/* frameQueue.length >= 10 ||  */ decoder.decodeQueueSize >= 3) {
		isFeedingPaused = true;
		if (DEBUG_QUEUES)
			console.log(
				'Decoder backpressure: Pausing feeding. frameQueue:',
				frameQueue.length,
				'decodeQueueSize:',
				decoder.decodeQueueSize
			);
		return; // Stop feeding for now
	}

	// If we have chunks in our buffer and not paused, send them
	if ((playing || seeking) && encodedChunkBuffer.length > 0) {
		const chunk = encodedChunkBuffer.shift();
		if (!chunk) return;
		try {
			decoder.decode(chunk);
			feedDecoder();
		} catch (e) {
			console.error('Error decoding chunk:', e);
		}
	} else {
		if (DEBUG_QUEUES) console.log('No more chunks in the buffer to feed');
		seeking = false;
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
