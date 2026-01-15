import { EncodedPacketSink } from 'mediabunny';

const DEBUG = false;

export class VDecoder {
	private decoder: VideoDecoder | undefined;
	private ready = false;
	private packetSink: EncodedPacketSink | undefined;
	private frameQueue: VideoFrame[] = [];
	private lastFrame?: VideoFrame | null = null;
	private savedFrame?: VideoFrame | null = null;
	private savedFrameNumber = 0;
	private startToQueueFrames = false;

	private currentChunk: EncodedVideoChunk | null = null;
	private bestChunkTimestamp: number = -1;
	private queueDequeue: Promise<void> | undefined;
	private resumeFeedingChunks: ((value: void | PromiseLike<void>) => void) | undefined;
	private targetTimestamp: number = -1;
	private foundTargetFrame = false;

	id = 0;
	running = false;
	clipId: string | null = null;
	lastUsedTime = 0;
	usedThisFrame = false;

	constructor() {
		this.decoder = new VideoDecoder({
			output: (frame: VideoFrame) => {
				if (this.running) {
					if (this.foundTargetFrame) {
						this.frameQueue.push(frame);
					} else {
						// We are still searching...
						this.resumeFeedingChunks?.();

						if (this.lastFrame) {
							// If the NEW frame is >= target, then the OLD frame (lastFrame)
							// is the one we want to queue first
							if (frame.timestamp > this.targetTimestamp) {
								this.frameQueue.push(this.lastFrame);
								this.frameQueue.push(frame);
								this.foundTargetFrame = true;
								this.lastFrame = null;
							} else if (frame.timestamp === this.targetTimestamp) {
								// Edge case: Perfect match. We don't need lastFrame
								this.lastFrame.close();
								this.frameQueue.push(frame);
								this.foundTargetFrame = true;
								this.lastFrame = null;
							} else {
								// Still haven't hit the target
								this.lastFrame.close();
								this.lastFrame = frame;
							}
						} else {
							// First frame from decoder
							this.lastFrame = frame;
						}
					}
				} else {
					this.resumeFeedingChunks?.();
					if (this.bestChunkTimestamp > -1 && frame.timestamp === this.bestChunkTimestamp) {
						this.savedFrame = frame;
					} else {
						frame.close();
					}
				}
			},
			error: (e) => {
				console.error(e);
			}
		});
	}

	setup(config: VideoDecoderConfig, packetSink: EncodedPacketSink) {
		this.savedFrame?.close();
		this.savedFrame = null;
		this.decoder?.configure(config);
		this.packetSink = packetSink;
		this.ready = true;
	}

	/** Called when seeking */
	async decodeFrame(frameNumber: number) {
		if (!this.decoder || !this.ready || !this.packetSink) return;
		this.bestChunkTimestamp = -1;

		// We need to close this.savedFrame here as we replace it below
		if (this.savedFrame) {
			if (this.savedFrameNumber === frameNumber) {
				return this.savedFrame;
			} else {
				this.savedFrame.close();
			}
		}

		let keyPacket = await this.packetSink.getKeyPacket(frameNumber / 30, {
			verifyKeyPackets: true
		});
		if (!keyPacket) keyPacket = await this.packetSink.getFirstPacket();
		if (!keyPacket) throw new Error('No key packet');
		this.currentChunk = keyPacket.toEncodedVideoChunk();
		const packets = this.packetSink.packets(keyPacket, undefined);
		await packets.next(); // Skip the start packet as we already have it

		const targetTimestamp = Math.floor((frameNumber / 30) * 1_000_000);
		this.bestChunkTimestamp = this.currentChunk.timestamp;
		let minDelta = Math.abs(targetTimestamp - this.currentChunk.timestamp);

		while (true) {
			// Lets try a queue size of 8, maybe change in future
			// https://github.com/Vanilagy/mediabunny/blob/571fbb31986c7e9b37310e144121ac964d48a29b/src/media-sink.ts#L793
			if (this.decoder.decodeQueueSize > 8) {
				({ promise: this.queueDequeue, resolve: this.resumeFeedingChunks } =
					Promise.withResolvers());
				await this.queueDequeue;
				continue;
			}

			this.decoder.decode(this.currentChunk);
			const packetResult = await packets.next();
			if (packetResult.done) break;

			this.currentChunk = packetResult.value.toEncodedVideoChunk();
			const currentDelta = Math.abs(targetTimestamp - this.currentChunk.timestamp);

			if (currentDelta < minDelta) {
				minDelta = currentDelta;
				this.bestChunkTimestamp = this.currentChunk.timestamp;
			}
			// Only stop once we are significantly past the target
			// this ensures reordered frames (B-frames) have all been processed
			if (this.currentChunk.timestamp > targetTimestamp + 100_000) break;
		}

		await packets.return();
		await this.decoder.flush();

		this.savedFrameNumber = frameNumber;
		return this.savedFrame;
	}

	async play(frameNumber: number) {
		if (!this.decoder || !this.packetSink) return;
		if (this.running) return;

		this.lastFrame?.close();
		this.lastFrame = null;

		this.running = true;
		this.startToQueueFrames = false;
		this.clearFrameQueue();

		this.targetTimestamp = Math.floor((frameNumber / 30) * 1_000_000);
		this.foundTargetFrame = false;

		let keyPacket = await this.packetSink.getKeyPacket(frameNumber / 30, {
			verifyKeyPackets: true
		});
		if (!keyPacket) keyPacket = await this.packetSink.getFirstPacket();
		if (!keyPacket) throw new Error('No key packet');

		this.currentChunk = keyPacket.toEncodedVideoChunk();
		const packets = this.packetSink.packets(keyPacket, undefined);
		await packets.next(); // Skip the start packet as we already have it

		while (this.running) {
			if (this.decoder.decodeQueueSize > 8) {
				({ promise: this.queueDequeue, resolve: this.resumeFeedingChunks } =
					Promise.withResolvers());
				await this.queueDequeue;
				continue;
			}
			this.decoder.decode(this.currentChunk);
			const packetResult = await packets.next();
			if (packetResult.done) break;

			this.currentChunk = packetResult.value.toEncodedVideoChunk();
		}

		await packets.return();
	}

	/** Called quickly during playback and encoding */
	run(timeMs: number, encoding = false) {
		if (this.startToQueueFrames && this.frameQueue.length < 3) {
			this.resumeFeedingChunks?.();
		}

		// Nothing in frame queue so return saved frame
		if (this.frameQueue.length < 1 && !encoding) {
			return this.savedFrame;
		}

		// Find closest frame in frame queue
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
		if (this.savedFrame) {
			const lastFrameDelta = Math.abs(frameTime - this.savedFrame.timestamp);
			if (lastFrameDelta < minTimeDelta) {
				if (DEBUG) console.log(`last frame is closer, returning ${this.savedFrame.timestamp}`);
				return this.savedFrame;
			}
		}

		for (let i = 0; i < frameIndex; i++) {
			const staleFrame = this.frameQueue.shift();
			staleFrame?.close();
		}

		const chosenFrame = this.frameQueue.shift();
		if (chosenFrame && chosenFrame.format) {
			this.lastFrame?.close();
			this.lastFrame = chosenFrame;
			this.startToQueueFrames = true;
			if (DEBUG)
				console.log(
					`Returning frame, delta: ${minTimeDelta / 1000}ms \n` +
						`want: ${frameTime} got: ${chosenFrame.timestamp}`
				);
			return chosenFrame;
		}

		if (this.savedFrame && !encoding) {
			console.log('returning an old frame');
			return this.lastFrame;
		}
	}

	async pause() {
		if (!this.running) return;
		this.running = false;
		if (DEBUG)
			console.log(`Decoder ${this.id} paused. Frames left in queue: ${this.frameQueue.length}`);
		this.decoder?.flush();
		this.clearFrameQueue();
		this.startToQueueFrames = false;
	}

	private async clearFrameQueue() {
		for (let i = 0; i < this.frameQueue.length; i++) {
			this.frameQueue[i].close();
		}
		this.frameQueue.length = 0;
	}
}
