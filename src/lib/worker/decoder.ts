import {
	EncodedPacket,
	EncodedPacketSink,
	VideoSampleSink,
	type InputVideoTrack
} from 'mediabunny';

const DEBUG = false;

export class VDecoder {
	private decoder: VideoDecoder;
	private decoderConfig: VideoDecoderConfig | null = null;
	private ready = false;
	running = false;

	private videoTrack: InputVideoTrack | undefined;
	private sink: VideoSampleSink | undefined;
	private packetSink: EncodedPacketSink | undefined;
	private lastPacket: EncodedPacket | undefined;
	/** All chunks */
	private chunks: EncodedVideoChunk[] = [];
	/** Chunks waiting to be decoded */
	private chunkBuffer: EncodedVideoChunk[] = [];
	/** Decoded frames waiting to be returned */
	private frameQueue: VideoFrame[] = [];
	private lastFrame?: VideoFrame;
	private lastFrameNumber = 0;
	private frameIsReady: (value: VideoFrame | PromiseLike<VideoFrame>) => void = () => {};

	/** Used when seeking */
	private targetFrameTimestamp = 0;
	/** Used when running */
	private startingFrameTimeStamp = 0;
	private lastChunkIndex = 0;
	private startToQueueFrames = false;

	id = 0;
	clipId: string | null = null;
	lastUsedTime = 0;
	usedThisFrame = false;
	openKeyFrames = new Set();

	constructor() {
		this.decoder = new VideoDecoder({ output: this.onFrame, error: this.onError });
	}

	setup(config: VideoDecoderConfig, track: InputVideoTrack) {
		this.decoderConfig = config;
		this.decoder.configure(this.decoderConfig);
		this.videoTrack = track;
		this.sink = new VideoSampleSink(this.videoTrack);
		this.packetSink = new EncodedPacketSink(this.videoTrack);
		//this.chunks = chunks;
		this.ready = true;
	}

	async decodeFrame(frameNumber: number): Promise<VideoFrame | undefined> {
		if (!this.ready || !this.sink) return;

		if (this.lastFrame) {
			if (this.lastFrameNumber === frameNumber) {
				return this.lastFrame;
			} else {
				this.openKeyFrames.delete(this.lastFrame.timestamp);
				this.lastFrame.close();
			}
		}

		const sample = await this.sink.getSample(frameNumber / 30);
		if (!sample) return;

		const frame = sample.toVideoFrame();
		sample.close();

		this.openKeyFrames.add(frame.timestamp);

		this.lastFrame = frame;
		this.lastFrameNumber = frameNumber;

		return frame;

		/* 		this.chunkBuffer = [];
		await this.decoder.flush();

		const frameTimestamp = Math.floor(frameNumber * 33333.3333333) + 33333 / 2;

		const { targetFrameIndex, keyFrameIndex, maxTimestamp } = this.getKeyFrameIndex(frameTimestamp);

		this.targetFrameTimestamp = this.chunks[targetFrameIndex].timestamp;

		if (this.lastFrame) {
			if (this.lastFrame.timestamp === this.targetFrameTimestamp) {
				return Promise.resolve(this.lastFrame);
			} else {
				this.lastFrame.close();
			}
		}

		if (maxTimestamp && maxTimestamp + 33333 < frameTimestamp) {
			// Out of bounds
			return Promise.resolve(null);
		}

		for (let i = keyFrameIndex; i < targetFrameIndex + 10; i++) {
			this.chunkBuffer.push(this.chunks[i]);
		}

		this.feedDecoder();

		return new Promise((resolve) => {
			this.frameIsReady = resolve;
		}); */
	}

	async play(frameNumber: number) {
		if (this.running || !this.packetSink) return;

		this.chunkBuffer = [];
		await this.decoder.flush();

		this.running = true;
		//const frameTimestamp = Math.floor(frameNumber * 33333.3333333) + 33333 / 2;
		//const { targetFrameIndex, keyFrameIndex } = this.getKeyFrameIndex(frameTimestamp);

		//this.startingFrameTimeStamp = this.chunks[targetFrameIndex].timestamp;

		const firstPacket = await this.packetSink.getKeyPacket(frameNumber / 30, {
			verifyKeyPackets: true
		});
		const endPacket = await this.packetSink.getPacket((frameNumber + 10) / 30);
		if (!firstPacket || !endPacket) return;
		this.lastPacket = endPacket;
		//this.chunkBuffer.push(firstPacket.toEncodedVideoChunk());

		for await (const packet of this.packetSink.packets(firstPacket, endPacket)) {
			this.chunkBuffer.push(packet.toEncodedVideoChunk());
		}

		this.startingFrameTimeStamp = firstPacket.toEncodedVideoChunk().timestamp;
		console.log(this.startingFrameTimeStamp);

		/* for (const chunk of this.chunkBuffer) {
			console.log(chunk.type);
		} */

		/* for (let i = keyFrameIndex; i < targetFrameIndex + 10; i++) {
			this.chunkBuffer.push(this.chunks[i]);
			this.lastChunkIndex = i;
		} */
		this.feedDecoder();
	}

	async fillBuffer() {
		if (!this.packetSink || !this.lastPacket) return;
		const endPacket = await this.packetSink.getPacket(this.lastPacket.timestamp + 0.1);
		if (!endPacket) return;
		for await (const packet of this.packetSink.packets(this.lastPacket, endPacket)) {
			this.chunkBuffer.push(packet.toEncodedVideoChunk());
		}
		this.lastPacket = endPacket;
	}

	/** Called quickly during playback and encoding to keep frame queue full */
	run(elapsedTimeMs: number, encoding = false) {
		// Keep chunk buffer full
		if (this.chunkBuffer.length < 5) {
			if (DEBUG) console.log('fill chunk buffer starting with index ', this.lastChunkIndex + 1);
			this.fillBuffer();

			/* for (let i = this.lastChunkIndex + 1, j = 0; j < 10; i++, j++) {
				this.chunkBuffer.push(this.chunks[i]);
				this.lastChunkIndex = i;
			} */
			this.feedDecoder();
		}

		const frameTime = Math.floor(elapsedTimeMs * 1000);
		let minTimeDelta = Infinity;
		let frameIndex = -1;
		for (let i = 0; i < this.frameQueue.length; i++) {
			const time_delta = Math.abs(frameTime - this.frameQueue[i].timestamp);
			if (time_delta < minTimeDelta) {
				minTimeDelta = time_delta;
				frameIndex = i;
			} else {
				break;
			}
		}
		//console.log('aiming for -> ', frameTime);
		/* for (const chunk of this.frameQueue) {
			console.log('we have: ', chunk.timestamp);
		} */

		// If source has lower framerate than timeline we may need to return
		// previous frame rather than grabbing a frame from framequeue
		/* 	if (this.lastFrame) {
			const lastFrameDelta = Math.abs(frameTime - this.lastFrame.timestamp);
			if (lastFrameDelta < minTimeDelta) {
				if (DEBUG) console.log(`last frame is closer, returning ${this.lastFrame.timestamp}`);
				return this.lastFrame;
			}
		} */

		for (let i = 0; i < frameIndex; i++) {
			const staleFrame = this.frameQueue.shift();
			staleFrame?.close();
		}

		const chosenFrame = this.frameQueue.shift();
		if (chosenFrame && chosenFrame.format) {
			if (this.lastFrame) this.lastFrame.close();
			this.lastFrame = chosenFrame;
			if (DEBUG)
				console.log(
					`Returning frame, delta: ${minTimeDelta / 1000}ms \n` +
						`want: ${frameTime} got: ${chosenFrame.timestamp}`
				);

			return chosenFrame;
		}
		if (this.lastFrame && !encoding) {
			if (DEBUG) console.log('returning an old frame');
			return this.lastFrame;
		}
	}

	async pause() {
		if (!this.running) return;
		this.running = false;
		if (DEBUG)
			console.log(`Decoder ${this.id} paused. Frames left in queue: ${this.frameQueue.length}`);

		for (let i = 0; i < this.frameQueue.length; i++) {
			this.frameQueue[i].close();
		}
		this.frameQueue = [];
		this.chunkBuffer = [];
		this.startToQueueFrames = false;
		await this.decoder.flush();
	}

	// Runs in a loop until chunk buffer is empty
	private feedDecoder() {
		if (this.decoder.decodeQueueSize >= 5) {
			if (DEBUG)
				console.log(
					'Skip feeding. #frameQueue:',
					this.frameQueue.length,
					'decodeQueueSize:',
					this.decoder.decodeQueueSize
				);
			return; // Stop feeding for now
		}
		if (this.chunkBuffer.length > 0) {
			const chunk = this.chunkBuffer.shift();
			if (!chunk) {
				// Undefined chunks in the buffer mean we are at the end of the video file,
				// so flush the encoder to make sure last few chunks make it through
				this.decoder.flush();
				return;
			}
			try {
				if (DEBUG) console.log(`Sending chunk to encoder: ${chunk.timestamp} (${chunk.type})`);
				this.decoder.decode(chunk);
				this.feedDecoder();
			} catch (e) {
				if (DEBUG) console.error('Error decoding chunk:', e);
			}
		} else {
			if (DEBUG) console.log('No more chunks in the buffer to feed');
		}
	}

	private onFrame = (frame: VideoFrame) => {
		if (DEBUG) {
			console.log('Frame output:', frame.timestamp);
			console.log('Queue size:', this.decoder.decodeQueueSize);
			console.log('Frame Queue Size:', this.frameQueue.length);
		}
		if (this.running) {
			if (this.startToQueueFrames) {
				this.frameQueue.push(frame);
			} else if (frame.timestamp === this.startingFrameTimeStamp) {
				this.startToQueueFrames = true;
				this.frameQueue.push(frame);
			} else {
				frame.close();
			}
		} else if (frame.timestamp === this.targetFrameTimestamp) {
			this.frameIsReady(frame);
			this.lastFrame = frame;
		} else {
			frame.close();
		}

		if (this.decoder.decodeQueueSize < 3) {
			if (DEBUG) console.log('Resuming feeding, decoder queue small enough');
			this.feedDecoder();
		}
		if (this.frameQueue.length > 10) {
			if (DEBUG) console.log('Resuming feeding, frame queue getting big');
			this.feedDecoder();
		}
	};

	private onError = (e: DOMException) => {
		// TODO: encoder may be reclaimed and we should check for that
		// and assign a new decoder to clip
		//this.decoder.reset();
		//this.decoder.configure(this.decoderConfig!);
		console.log(e);
	};

	private getKeyFrameIndex(frameTimestamp: number) {
		let targetFrameIndex = 0;
		let keyFrameIndex = 0;
		let scanForKeyframe = false;
		let maxTimestamp;
		for (let i = this.chunks.length - 1; i >= 0; i--) {
			if (i === this.chunks.length - 1) {
				maxTimestamp = this.chunks[i].timestamp;
			}
			if (!scanForKeyframe && this.chunks[i].timestamp < frameTimestamp) {
				targetFrameIndex = i;

				scanForKeyframe = true;
			}
			if (scanForKeyframe) {
				if (this.chunks[i].type === 'key') {
					keyFrameIndex = i;
					break;
				}
			}
		}
		if (DEBUG)
			console.log(
				`requesting frame: ${frameTimestamp}, so choosing ${this.chunks[targetFrameIndex].timestamp}`
			);

		return {
			targetFrameIndex,
			keyFrameIndex,
			maxTimestamp
		};
	}
}
