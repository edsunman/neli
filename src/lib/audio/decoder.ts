import type { EncodedPacketSink } from 'mediabunny';

export class ADecoder {
	private decoder;
	private decoderConfig: AudioDecoderConfig | null = null;
	private packetSink: EncodedPacketSink | undefined;
	private currentChunk: EncodedAudioChunk | undefined;

	private lastAudioDataTimestamp = 0;
	private audioDataQueueFull = false;
	private startingFrameTimeStamp = 0;

	private queueDequeue: Promise<void> | undefined;
	private resumeFeedingChunks: ((value: void | PromiseLike<void>) => void) | undefined;

	id = 0;
	lastUsedTime = 0;
	sampleRate = 0;
	running = false;
	audioDataQueue: AudioData[] = [];

	constructor() {
		this.decoder = new AudioDecoder({ output: this.onOutput, error: this.onError });
	}

	setup(config: AudioDecoderConfig, sink: EncodedPacketSink) {
		console.log(sink);
		this.decoderConfig = config;
		this.decoder.configure(this.decoderConfig);
		this.packetSink = sink;
		this.sampleRate = config.sampleRate;
	}

	async play(frameNumber: number) {
		if (!this.packetSink) return;
		if (this.running) return;
		this.running = true;
		this.audioDataQueueFull = false;

		let startPacket = await this.packetSink.getPacket(frameNumber / 30);
		if (!startPacket) startPacket = await this.packetSink.getFirstPacket();
		if (!startPacket) throw new Error('No start packet');

		this.currentChunk = startPacket.toEncodedAudioChunk();
		this.startingFrameTimeStamp = this.currentChunk.timestamp;
		const packets = this.packetSink.packets(startPacket, undefined);
		await packets.next(); // Skip the start packet as we already have it

		while (this.running) {
			if (this.decoder.decodeQueueSize > 8 || this.audioDataQueueFull) {
				({ promise: this.queueDequeue, resolve: this.resumeFeedingChunks } =
					Promise.withResolvers());
				await this.queueDequeue;
				continue;
			}

			this.decoder.decode(this.currentChunk);
			const packetResult = await packets.next();
			if (packetResult.done) break;

			this.currentChunk = packetResult.value.toEncodedAudioChunk();
		}
		await packets.return();
	}

	run(elapsedTimeMs: number, encoding = false) {
		const elapsedMicroSeconds = Math.floor(elapsedTimeMs * 1000);
		this.audioDataQueueFull = false;
		if (
			elapsedMicroSeconds + this.startingFrameTimeStamp + 3e6 < this.lastAudioDataTimestamp &&
			!encoding
		) {
			// more that three seconds of audio buffer
			this.audioDataQueueFull = true;
		}
		this.resumeFeedingChunks?.();
	}

	pause() {
		if (!this.running) return;
		this.running = false;
		this.resumeFeedingChunks?.();
		for (let i = 0; i < this.audioDataQueue.length; i++) {
			this.audioDataQueue[i].close();
		}
		this.audioDataQueue.length = 0;
		this.lastAudioDataTimestamp = 0;
		this.decoder.flush();
	}

	private onOutput = (audioData: AudioData) => {
		if (this.running) {
			this.resumeFeedingChunks?.();
			this.audioDataQueue.push(audioData);
			this.lastAudioDataTimestamp = audioData.timestamp;
		}
	};
	private onError(e: DOMException) {
		console.log(e);
	}
}
