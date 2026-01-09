import { VideoSample, VideoSampleSink, type InputVideoTrack } from 'mediabunny';

const DEBUG = false;

export class VDecoder {
	private ready = false;
	private videoTrack: InputVideoTrack | undefined;
	private sink: VideoSampleSink | undefined;
	private iterator: AsyncGenerator<VideoSample, void, unknown> | undefined;
	private frameQueue: VideoFrame[] = [];
	private lastFrame?: VideoFrame | null = null;
	private lastFrameNumber = 0;
	private startToQueueFrames = false;

	id = 0;
	running = false;
	clipId: string | null = null;
	lastUsedTime = 0;
	usedThisFrame = false;
	openKeyFrames = new Set();

	setup(config: VideoDecoderConfig, track: InputVideoTrack) {
		this.videoTrack = track;
		this.sink = new VideoSampleSink(this.videoTrack);
		this.ready = true;
	}

	async decodeFrame(frameNumber: number): Promise<VideoFrame | undefined> {
		if (!this.ready || !this.sink) return;

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
		this.clearFrameQueue();

		await this.iterator?.return();

		this.iterator = this.sink?.samples(frameNumber / 30);

		if (!this.iterator) {
			throw Error('no iterator assigned');
		}

		this.fillFrameQueue();
	}

	/** Called quickly during playback and encoding */
	run(timeMs: number, encoding = false) {
		if (!this.iterator) return;

		if (this.startToQueueFrames && this.frameQueue.length < 3) {
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

		this.clearFrameQueue();
		this.startToQueueFrames = false;
		await this.iterator?.return();
	}

	private async fillFrameQueue() {
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

	private async clearFrameQueue() {
		for (let i = 0; i < this.frameQueue.length; i++) {
			this.openKeyFrames.delete(this.frameQueue[i].timestamp);
			this.frameQueue[i].close();
		}
		this.frameQueue = [];
	}
}
