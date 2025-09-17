const DEBUG = false;

export class VDecoder {
	#decoder;
	#decoderConfig: VideoDecoderConfig | null = null;
	#ready = false;
	#running = false;

	/** all chunks */
	#chunks: EncodedVideoChunk[] = [];
	/** chunks waiting to be decoded */
	#chunkBuffer: EncodedVideoChunk[] = [];
	/** decoded frames waiting to be returned */
	#frameQueue: VideoFrame[] = [];
	#lastFrame?: VideoFrame;
	#frameIsReady: (value: VideoFrame | PromiseLike<VideoFrame>) => void = () => {};

	/** used when seeking */
	#targetFrameTimestamp = 0;
	/** used when playing */
	#startingFrameTimeStamp = 0;
	#lastChunkIndex = 0;
	#feedingPaused = false;
	#startToQueueFrames = false;

	id = 0;
	clipId: string | null = null;
	lastUsedTime = 0;
	usedThisFrame = false;

	constructor() {
		this.#decoder = new VideoDecoder({ output: this.#onFrame, error: this.#onError });
	}

	setup(config: VideoDecoderConfig, chunks: EncodedVideoChunk[]) {
		this.#decoderConfig = config;
		this.#decoder.configure(this.#decoderConfig);
		this.#chunks = chunks;
		this.#ready = true;
	}

	async decodeFrame(frameNumber: number): Promise<VideoFrame | null> {
		if (!this.#ready) return null;

		await this.#decoder.flush();

		const frameTimestamp = Math.floor(frameNumber * 33333.3333333) + 33333 / 2;

		const { targetFrameIndex, keyFrameIndex, maxTimestamp } =
			this.#getKeyFrameIndex(frameTimestamp);

		this.#targetFrameTimestamp = this.#chunks[targetFrameIndex].timestamp;

		if (this.#lastFrame) {
			if (this.#lastFrame.timestamp === this.#targetFrameTimestamp) {
				return Promise.resolve(this.#lastFrame);
			} else {
				this.#lastFrame.close();
			}
		}

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

	async play(frameNumber: number) {
		if (this.#running) return;
		await this.#decoder.flush();
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

	/** Called quickly during playback and encoding to keep frame queue full */
	run(elapsedTimeMs: number) {
		const frameTime = Math.floor(elapsedTimeMs * 1000);
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

		if (this.#chunkBuffer.length < 5) {
			if (DEBUG) console.log('fill chunk buffer starting with index ', this.#lastChunkIndex + 1);

			for (let i = this.#lastChunkIndex + 1, j = 0; j < 10; i++, j++) {
				this.#chunkBuffer.push(this.#chunks[i]);
				this.#lastChunkIndex = i;
			}

			this.#feedDecoder();
		}

		const chosenFrame = this.#frameQueue.shift();

		if (chosenFrame && chosenFrame.format) {
			if (this.#lastFrame) this.#lastFrame.close();
			this.#lastFrame = chosenFrame;

			if (DEBUG)
				console.log(
					'Returning frame. Frame time delta = %dms (%d vs %d)',
					minTimeDelta / 1000,
					frameTime,
					chosenFrame.timestamp
				);

			return chosenFrame;
		}
		if (this.#lastFrame) {
			return this.#lastFrame;
		}
	}

	async pause() {
		if (!this.running) return;
		this.#running = false;
		if (DEBUG)
			console.log(`Decoder ${this.id} paused. Frames left in queue: ${this.#frameQueue.length}`);

		for (let i = 0; i < this.#frameQueue.length; i++) {
			this.#frameQueue[i].close();
		}
		this.#frameQueue = [];
		this.#chunkBuffer = [];
		this.#startToQueueFrames = false;
		await this.#decoder.flush();
		//console.log(`Decoder ${this.id} flushed`);
	}

	get running() {
		return this.#running;
	}

	// runs in a loop until chunk buffer is empty
	#feedDecoder() {
		if (this.#feedingPaused) return;
		if (this.#decoder.decodeQueueSize >= 5) {
			this.#feedingPaused = true;
			if (DEBUG)
				console.log(
					'Pausing feeding. #frameQueue:',
					this.#frameQueue.length,
					'decodeQueueSize:',
					this.#decoder.decodeQueueSize
				);
			return; // Stop feeding for now
		}
		if (this.#chunkBuffer.length > 0) {
			const chunk = this.#chunkBuffer.shift();
			if (!chunk) {
				// undefined chunks in the buffer mean we are at the end of the video file,
				// so flush the encoder to make sure last few chunks make it through
				this.#decoder.flush();
				return;
			}
			try {
				if (DEBUG) console.log('Sending chunk to encoder: ', chunk.timestamp);
				this.#decoder.decode(chunk);
				this.#feedDecoder();
			} catch (e) {
				if (DEBUG) console.error('Error decoding chunk:', e);
			}
		} else {
			if (DEBUG) console.log('No more chunks in the buffer to feed');
		}
	}

	#onFrame = (frame: VideoFrame) => {
		if (DEBUG) {
			console.log('Frame output:', frame.timestamp);
			console.log('Queue size:', this.#decoder.decodeQueueSize);
			console.log('Frame Queue Size:', this.#frameQueue.length);
		}
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
			this.#lastFrame = frame;
		} else {
			frame.close();
		}

		if (!this.#feedingPaused) return;

		if (this.#decoder.decodeQueueSize < 3) {
			if (DEBUG) console.log('Resuming feeding.');
			this.#feedingPaused = false;
			this.#feedDecoder();
		}
		if (this.#frameQueue.length > 10) {
			if (DEBUG) console.log('Force feeding.');
			this.#feedingPaused = false;
			this.#feedDecoder();
		}
	};

	#onError = (e: DOMException) => {
		// TODO: encoder may be reclaimed and we should check for that
		// and assign a new decoder to clip
		//this.#decoder.reset();
		//this.#decoder.configure(this.#decoderConfig!);
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
		if (DEBUG)
			console.log(
				`requesting frame: ${frameTimestamp}, so choosing ${this.#chunks[targetFrameIndex].timestamp}`
			);

		return {
			targetFrameIndex,
			keyFrameIndex,
			maxTimestamp
		};
	}
}
