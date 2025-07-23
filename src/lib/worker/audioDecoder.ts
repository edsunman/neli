//import { audioManager } from '$lib/state.svelte';

const DEBUG = false;
//const AUDIO_CHUNK_FRAMES = 1024;
//const BATCH_FRAMES_TARGET = AUDIO_CHUNK_FRAMES * 8; // Send 4 'internal' chunks at once

/**
 * Responsible for demuxing and storing video chunks, then
 * decoding video chunks and returning video frames.
 */
export class Audio_Decoder {
	#decoder;
	#decoderConfig: AudioDecoderConfig | null = null;
	//#ready = false;
	#running = false;

	/** all chunks */
	#chunks: EncodedAudioChunk[] = [];
	/** chunks waiting to be decoded */
	#chunkBuffer: EncodedAudioChunk[] = [];
	audioDataQueue: AudioData[] = [];

	#lastChunkIndex = 0;
	#lastAudioDataTimestamp = 0;
	#feedingPaused = false;

	//#currentBatchFrames = 0;
	#startingFrameTimeStamp = 0;

	constructor() {
		this.#decoder = new AudioDecoder({ output: this.#onOutput, error: this.#onError });
	}

	setup(config: AudioDecoderConfig, chunks: EncodedAudioChunk[]) {
		this.#decoderConfig = config;
		this.#decoder.configure(this.#decoderConfig);
		this.#chunks = chunks;
	}

	play(frameNumber: number) {
		if (this.#running) return;
		this.#running = true;

		const frameTimestamp = Math.floor(frameNumber * 33333.3333333) + 33333 / 2;

		let startingChunkIndex = 0;
		for (let i = 0; i < this.#chunks.length; i++) {
			if (frameTimestamp <= this.#chunks[i].timestamp) {
				startingChunkIndex = i;
				break;
			}
		}

		this.#startingFrameTimeStamp = this.#chunks[startingChunkIndex].timestamp;

		this.#chunkBuffer = [];
		for (let i = startingChunkIndex; i < startingChunkIndex + 30; i++) {
			this.#chunkBuffer.push(this.#chunks[i]);
			this.#lastChunkIndex = i;
		}
		this.#feedDecoder();
	}

	pause() {
		this.#running = false;
		if (DEBUG) console.log('Paused. Audio data left in queue:', this.audioDataQueue.length);

		for (let i = 0; i < this.audioDataQueue.length; i++) {
			this.audioDataQueue[i].close();
		}
		this.audioDataQueue = [];
		this.#chunkBuffer = [];
		//this.#currentBatchFrames = 0;
		this.#lastAudioDataTimestamp = 0;
		this.#decoder.flush();
	}

	run(elapsedTimeMs: number, encoding = false) {
		const elapsedMicroSeconds = Math.floor(elapsedTimeMs * 1000);

		if (
			elapsedMicroSeconds + this.#startingFrameTimeStamp + 3e6 < this.#lastAudioDataTimestamp &&
			!encoding
		) {
			// more that three seconds of audio buffer
			return;
		}

		if (this.#chunkBuffer.length < 5) {
			if (DEBUG) console.log('fill chunk buffer starting with index ', this.#lastChunkIndex + 1);

			for (let i = this.#lastChunkIndex + 1, j = 0; j < 10; i++, j++) {
				this.#chunkBuffer.push(this.#chunks[i]);
				this.#lastChunkIndex = i;
			}

			this.#feedDecoder();
		}
	}

	#onOutput = (audioData: AudioData) => {
		if (this.#running) {
			this.audioDataQueue.push(audioData);
			this.#lastAudioDataTimestamp = audioData.timestamp;
			/*
			this.#currentBatchFrames += audioData.numberOfFrames;
			console.log(this.#currentBatchFrames);
			if (this.#currentBatchFrames >= BATCH_FRAMES_TARGET) {
				const combinedBatchBuffer = new Float32Array(this.#currentBatchFrames * 2);

				let offset = 0;
				for (const audioData of this.#audioDataQueue) {
					for (let i = 0; i < 2; i++) {
						const planarData = new Float32Array(audioData.numberOfFrames);
						audioData.copyTo(planarData, {
							planeIndex: i,
							frameOffset: 0,
							frameCount: audioData.numberOfFrames
						});

						for (let j = 0; j < audioData.numberOfFrames; j++) {
							combinedBatchBuffer[offset + j * 2 + i] = planarData[j];
						}
					}

					offset += audioData.numberOfFrames * 2;
					audioData.close();
				}
				if (DEBUG) console.log('Sending batch to main thread');
				/* self.postMessage(
					{
						command: 'audio-chunk',
						audioData: combinedBatchBuffer.buffer
					},
					{ transfer: [combinedBatchBuffer.buffer] }
				); */
			/* audioManager.push(combinedBatchBuffer);
				this.#audioDataQueue.length = 0;
				this.#currentBatchFrames = 0;
			} */
		}
		if (this.#feedingPaused && this.#decoder.decodeQueueSize < 3) {
			this.#feedingPaused = false;
			if (DEBUG) console.log('Decoder backpressure: Resuming feeding.');
			this.#feedDecoder();
		}
	};
	#onError(e: DOMException) {
		console.log(e);
	}
	#feedDecoder() {
		if (this.#feedingPaused) return;
		if (this.#decoder.decodeQueueSize >= 5) {
			this.#feedingPaused = true;
			if (DEBUG)
				console.log(
					'Decoder backpressure: Pausing feeding. #audioDataQueue:',
					this.audioDataQueue.length,
					'decodeQueueSize:',
					this.#decoder.decodeQueueSize
				);
			return; // Stop feeding for now
		}
		if (this.#chunkBuffer.length > 0) {
			const chunk = this.#chunkBuffer.shift();
			if (!chunk) {
				// undefined chunks in the buffer mean we are at the end of the audio file,
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
}
