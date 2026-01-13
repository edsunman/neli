import { EncodedPacket, EncodedPacketSink, VideoSample, VideoSampleSink } from 'mediabunny';

const DEBUG = false;

export class VDecoder {
	private decoder: VideoDecoder | undefined;
	private ready = false;
	private packetSink: EncodedPacketSink | undefined;
	private sink: VideoSampleSink | undefined;
	private iterator: AsyncGenerator<VideoSample, void, unknown> | undefined;
	private frameQueue: VideoFrame[] = [];
	private lastFrame?: VideoFrame | null = null;
	private lastFrameNumber = 0;
	private startToQueueFrames = false;

	private currentPacket: EncodedPacket | null = null;
	private packetWasFound = false;
	private queueDequeue: Promise<void> | undefined;
	private onQueueDequeue: ((value: void | PromiseLike<void>) => void) | undefined;

	id = 0;
	running = false;
	clipId: string | null = null;
	lastUsedTime = 0;
	usedThisFrame = false;
	openKeyFrames = new Set();
	counter = 0;

	constructor() {
		this.decoder = new VideoDecoder({
			output: (frame: VideoFrame) => {
				this.onQueueDequeue!();
				this.counter++;
				if (this.counter === 1) {
					//console.log('found frame');
					this.packetWasFound = true;
					this.lastFrame = frame;
				} else {
					frame.close();
				}
			},
			error: (e) => {
				console.error(e);
			}
		});
	}

	setup(config: VideoDecoderConfig, sink: VideoSampleSink, packetSink: EncodedPacketSink) {
		this.decoder?.configure(config);
		this.sink = sink;
		this.packetSink = packetSink;
		this.ready = true;
	}

	// NOTE: lets try a queue size of 8, maybe change in fututre https://github.com/Vanilagy/mediabunny/blob/571fbb31986c7e9b37310e144121ac964d48a29b/src/media-sink.ts#L793

	/** Called when seeking */
	async decodeFrame(frameNumber: number) {
		if (!this.decoder || !this.ready || !this.packetSink) return;

		//await this.decoder.flush();
		this.counter = 0;
		this.packetWasFound = false;
		// We need to close the lastFrame here as we replace it below
		if (this.lastFrame) {
			if (this.lastFrameNumber === frameNumber) {
				return this.lastFrame;
			} else {
				this.openKeyFrames.delete(this.lastFrame.timestamp);
				this.lastFrame.close();
			}
		}

		const keyPacket = await this.packetSink.getKeyPacket(frameNumber / 30, {
			verifyKeyPackets: true
		});

		if (!keyPacket) throw new Error('No key packet');

		this.currentPacket = keyPacket;
		const packets = this.packetSink.packets(keyPacket, undefined);
		await packets.next(); // Skip the start packet as we already have it

		while (!this.packetWasFound) {
			if (this.decoder.decodeQueueSize > 8) {
				//console.log('pause queue');
				({ promise: this.queueDequeue, resolve: this.onQueueDequeue } = Promise.withResolvers());
				await this.queueDequeue;
				continue;
			}

			this.decoder.decode(this.currentPacket.toEncodedVideoChunk());
			const packetResult = await packets.next();
			if (packetResult.done) break;
			this.currentPacket = packetResult.value;
		}

		await packets.return();
		await this.decoder.flush();

		/* 		const sample = await this.sink.getSample(frameNumber / 30);

		const frame = sample.toVideoFrame();
		sample.close();

		this.openKeyFrames.add(frame.timestamp); */

		//this.lastFrame = frame;
		this.lastFrameNumber = frameNumber;

		return this.lastFrame;
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
