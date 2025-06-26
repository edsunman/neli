import {
	createFile,
	MP4BoxBuffer,
	DataStream,
	ISOFile,
	Endianness,
	VisualSampleEntry,
	MultiBufferStream
} from 'mp4box';

const DEBUG = true;

/**
    Responsible for demuxing and stroung a sources video chunks, then
    decoding video chunks and returning video frames.
*/
export class Decoder {
	#decoder;
	#ready = false;
	#running = false;
	#mp4File: ISOFile | null = null;

	/* all chunks */
	#chunks: EncodedVideoChunk[] = [];
	/* chunks waiting to be decoded */
	#chunkBuffer: EncodedVideoChunk[] = [];
	#frameQueue: VideoFrame[] = [];

	#frameIsReady: (value: VideoFrame | PromiseLike<VideoFrame>) => void = () => {};

	/* used when seeking */
	#targetFrameTimestamp = 0;
	/* used when playing */
	#startingFrameTimeStamp = 0;
	#lastChunkIndex = 0;
	#feedingPaused = false;
	#startToQueueFrames = false;

	constructor() {
		this.#decoder = new VideoDecoder({ output: this.#onFrame, error: this.#onError });
	}

	async loadFile(file: File) {
		let fileLoaded: (value: unknown) => void;
		const promise = new Promise((resolve) => {
			fileLoaded = resolve;
		});

		this.#mp4File = createFile();
		this.#mp4File.onReady = (info) => {
			console.log(info);

			this.#decoder.configure({
				codec: info.videoTracks[0].codec.startsWith('vp08') ? 'vp8' : info.videoTracks[0].codec,
				codedHeight: info.videoTracks[0].track_height,
				codedWidth: info.videoTracks[0].track_width,
				description: this.#getDescription(this.#mp4File),
				optimizeForLatency: true
			});
		};
		this.#mp4File.onSamples = (id, user, samples) => {
			for (const sample of samples) {
				const chunk = new EncodedVideoChunk({
					type: sample.is_sync ? 'key' : 'delta',
					timestamp: (1e6 * sample.cts) / sample.timescale,
					duration: (1e6 * sample.duration) / sample.timescale,
					data: sample.data!
				});
				this.#chunks.push(chunk);
			}

			if (samples.length < 1000) {
				this.#mp4File = null;
				this.#ready = true;
				fileLoaded('done');
			}
		};

		const reader = new FileReader();
		reader.onload = (e) => {
			const arrayBuffer = e.target?.result as MP4BoxBuffer;
			if (!this.#mp4File || !arrayBuffer) return;
			arrayBuffer.fileStart = 0;
			this.#mp4File.appendBuffer(arrayBuffer);
			this.#mp4File.flush();
			this.#mp4File.setExtractionOptions(1);
			this.#mp4File.start();
		};
		reader.readAsArrayBuffer(file);

		return promise;
	}

	decodeFrame(frameNumber: number): Promise<VideoFrame | null> | null {
		if (!this.#ready) return null;
		const frameTimestamp = Math.floor(frameNumber * 33333.3333333) + 33333 / 2;

		const { targetFrameIndex, keyFrameIndex, maxTimestamp } =
			this.#getKeyFrameIndex(frameTimestamp);

		this.#targetFrameTimestamp = this.#chunks[targetFrameIndex].timestamp;

		if (maxTimestamp && maxTimestamp + 33333 < frameTimestamp) {
			// out of bounds
			return Promise.resolve(null);
		}

		this.#chunkBuffer = [];
		for (let i = keyFrameIndex; i < targetFrameIndex + 10; i++) {
			this.#chunkBuffer.push(this.#chunks[i]);
		}

		this.#feedDecoder();

		return new Promise((resolve) => {
			this.#frameIsReady = resolve;
		});
	}

	play(frameNumber: number) {
		this.#running = true;

		const frameTimestamp = Math.floor(frameNumber * 33333.3333333) + 33333 / 2;
		const { targetFrameIndex, keyFrameIndex } = this.#getKeyFrameIndex(frameTimestamp);

		this.#startingFrameTimeStamp = this.#chunks[targetFrameIndex].timestamp;

		this.#chunkBuffer = [];
		for (let i = keyFrameIndex; i < targetFrameIndex + 10; i++) {
			this.#chunkBuffer.push(this.#chunks[i]);
			this.#lastChunkIndex = i;
		}
		this.#feedDecoder();
	}

	/** Called every RAF during playback to keep frame queue full */
	run(elapsedTimeMs: number) {
		console.log(elapsedTimeMs);
		const frameTime = Math.floor(elapsedTimeMs * 1000) + this.#startingFrameTimeStamp;

		let minTimeDelta = Infinity;
		let frameIndex = -1;
		for (let i = 0; i < this.#frameQueue.length; i++) {
			const time_delta = Math.abs(frameTime - this.#frameQueue[i].timestamp);
			if (time_delta < minTimeDelta) {
				minTimeDelta = time_delta;
				frameIndex = i;
			} else {
				break;
			}
		}

		for (let i = 0; i < frameIndex; i++) {
			const staleFrame = this.#frameQueue.shift();
			staleFrame?.close();
		}

		const chosenFrame = this.#frameQueue[0];

		if (this.#chunkBuffer.length < 5) {
			if (DEBUG) console.log('fill chunk buffer starting with index ', this.#lastChunkIndex + 1);

			for (let i = this.#lastChunkIndex + 1, j = 0; j < 10; i++, j++) {
				this.#chunkBuffer.push(this.#chunks[i]);
				this.#lastChunkIndex = i;
			}

			this.#feedDecoder();
		}

		if (chosenFrame && chosenFrame.format) {
			if (DEBUG)
				console.log(
					'Returning frame. Frame time delta = %dms (%d vs %d)',
					minTimeDelta / 1000,
					frameTime,
					chosenFrame.timestamp
				);
			return chosenFrame;
		}
	}

	pause() {
		this.#running = false;
		if (DEBUG) console.log('Paused. Frames left in queue:', this.#frameQueue.length);

		for (let i = 0; i < this.#frameQueue.length; i++) {
			this.#frameQueue[i].close();
		}
		this.#frameQueue = [];
		this.#chunkBuffer = [];
		this.#startToQueueFrames = false;
	}

	// runs in a loop until chunk buffer is empty
	#feedDecoder() {
		if (this.#feedingPaused) return;
		if (this.#decoder.decodeQueueSize >= 5) {
			this.#feedingPaused = true;
			if (DEBUG)
				console.log(
					'Decoder backpressure: Pausing feeding. #frameQueue:',
					this.#frameQueue.length,
					'decodeQueueSize:',
					this.#decoder.decodeQueueSize
				);
			return; // Stop feeding for now
		}
		if (this.#chunkBuffer.length > 0) {
			const chunk = this.#chunkBuffer.shift();
			if (!chunk) return;
			try {
				if (DEBUG) console.log('Sending chunk to encoder: ', chunk.timestamp);
				this.#decoder.decode(chunk);
				this.#feedDecoder();
			} catch (e) {
				console.error('Error decoding chunk:', e);
			}
		} else {
			if (DEBUG) console.log('No more chunks in the buffer to feed');
		}
	}

	#onFrame = (frame: VideoFrame) => {
		//console.log(frame);
		if (this.#running) {
			if (this.#startToQueueFrames) {
				this.#frameQueue.push(frame);
			} else if (frame.timestamp === this.#startingFrameTimeStamp) {
				this.#startToQueueFrames = true;
				this.#frameQueue.push(frame);
			} else {
				frame.close();
			}
		} else if (frame.timestamp === this.#targetFrameTimestamp) {
			this.#frameIsReady(frame);
		} else {
			frame.close();
		}
		if (this.#feedingPaused && this.#decoder.decodeQueueSize < 3) {
			this.#feedingPaused = false;
			if (DEBUG) console.log('Decoder backpressure: Resuming feeding.');
			this.#feedDecoder();
		}
	};

	#onError = (e: DOMException) => {
		console.log(e);
	};

	#getKeyFrameIndex(frameTimestamp: number) {
		let targetFrameIndex = 0;
		let keyFrameIndex = 0;
		let scanForKeyframe = false;
		let maxTimestamp;
		for (let i = this.#chunks.length - 1; i >= 0; i--) {
			if (i === this.#chunks.length - 1) {
				maxTimestamp = this.#chunks[i].timestamp;
			}
			if (!scanForKeyframe && this.#chunks[i].timestamp < frameTimestamp) {
				targetFrameIndex = i;

				scanForKeyframe = true;
			}
			if (scanForKeyframe) {
				if (this.#chunks[i].type === 'key') {
					keyFrameIndex = i;
					break;
				}
			}
		}
		return {
			targetFrameIndex,
			keyFrameIndex,
			maxTimestamp
		};
	}

	#getDescription(file: ISOFile | null) {
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
	}
}
