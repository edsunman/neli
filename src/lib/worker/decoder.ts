import {
	EncodedPacket,
	EncodedPacketSink,
	VideoSample,
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
	private iterator: AsyncGenerator<VideoSample, void, unknown> | undefined;

	//private packetSink: EncodedPacketSink | undefined;
	//private lastPacket: EncodedPacket | undefined;
	/** All chunks */
	private chunks: EncodedVideoChunk[] = [];
	/** Chunks waiting to be decoded */
	private chunkBuffer: EncodedVideoChunk[] = [];
	/** Decoded frames waiting to be returned */
	private frameQueue: VideoFrame[] = [];
	private lastFrame?: VideoFrame | null = null;
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
		//this.packetSink = new EncodedPacketSink(this.videoTrack);
		this.ready = true;
	}

	async decodeFrame(frameNumber: number): Promise<VideoFrame | undefined> {
		if (!this.ready || !this.sink) return;

		//console.log(this.openKeyFrames.size);

		// We need to close the lastFrame here as we replace it below
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
	}

	async play(frameNumber: number) {
		if (this.running) return;

		this.running = true;
		this.startToQueueFrames = false;
		for (let i = 0; i < this.frameQueue.length; i++) {
			this.openKeyFrames.delete(this.frameQueue[i].timestamp);
			this.frameQueue[i].close();
		}
		this.frameQueue = [];
		//await this.decoder.flush();

		await this.iterator?.return();

		this.iterator = this.sink?.samples(frameNumber / 30);

		if (!this.iterator) {
			throw Error('no iterator assigned');
		}

		this.fillFrameQueue();
	}

	async fillFrameQueue() {
		if (!this.iterator) {
			throw Error('no iterator assigned');
		}
		for (let i = 0; i < 5; i++) {
			const sample = (await this.iterator.next()).value ?? null;
			if (!sample) {
				//throw Error('no sample from iterator');
				continue;
			}
			const frame = sample.toVideoFrame();
			this.openKeyFrames.add(frame.timestamp);
			sample.close();
			this.frameQueue.push(frame);
		}

		return true;
	}

	/** Called quickly during playback and encoding to keep frame queue full */
	run(timeMs: number, encoding = false) {
		if (!this.iterator) return;

		//this.lastFrame?.close();
		//console.log(this.openKeyFrames.size);

		if (this.startToQueueFrames && this.frameQueue.length < 3) {
			//console.log('filling from run');
			this.fillFrameQueue();
		}

		const frameTime = Math.floor(timeMs * 1000);

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

		// If source has lower framerate than timeline we may need to return
		// previous frame rather than grabbing a frame from framequeue
		if (this.lastFrame) {
			const lastFrameDelta = Math.abs(frameTime - this.lastFrame.timestamp);
			if (lastFrameDelta < minTimeDelta) {
				if (DEBUG) console.log(`last frame is closer, returning ${this.lastFrame.timestamp}`);
				return this.lastFrame;
			}
		}

		for (let i = 0; i < frameIndex; i++) {
			const staleFrame = this.frameQueue.shift();
			if (staleFrame) {
				this.openKeyFrames.delete(staleFrame.timestamp);
				staleFrame.close();
			}
		}
		//console.log('framequeue:', this.frameQueue.length);
		const chosenFrame = this.frameQueue.shift();
		if (chosenFrame && chosenFrame.format) {
			if (this.lastFrame) {
				this.openKeyFrames.delete(this.lastFrame.timestamp);
				this.lastFrame.close();
			}
			this.lastFrame = chosenFrame;
			this.startToQueueFrames = true;
			if (DEBUG)
				console.log(
					`Returning frame, delta: ${minTimeDelta / 1000}ms \n` +
						`want: ${frameTime} got: ${chosenFrame.timestamp}`
				);

			return chosenFrame;
		}

		if (this.lastFrame && !encoding) {
			console.log('returning an old frame');
			return this.lastFrame;
		}
	}

	async pause() {
		if (!this.running) return;
		this.running = false;
		if (DEBUG)
			console.log(`Decoder ${this.id} paused. Frames left in queue: ${this.frameQueue.length}`);

		for (let i = 0; i < this.frameQueue.length; i++) {
			this.openKeyFrames.delete(this.frameQueue[i].timestamp);
			this.frameQueue[i].close();
		}
		this.frameQueue = [];
		this.chunkBuffer = [];
		this.startToQueueFrames = false;
		await this.decoder.flush();
		await this.iterator?.return();
		console.log('flushed');
	}

	// TODO: can this happen when we pause? I don't think so.. but maybe?
	clear() {
		/* 	this.lastFrame?.close();
		this.lastFrame = null; */
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
		/* if (DEBUG) {
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
		} */
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
