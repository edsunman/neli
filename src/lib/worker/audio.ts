import { RingBuffer } from 'ringbuf.js';

const DEBUG = false;
const DATA_BUFFER_DURATION = 0.6;
const AUDIO_CHUNK_FRAMES = 1024;
const BATCH_FRAMES = AUDIO_CHUNK_FRAMES * 16; // Send 4 'internal' chunks at once
const BATCH_SAMPLES = BATCH_FRAMES * 2; // Total samples in a batch

/**
 * Responsible for demuxing and storing video chunks, then
 * decoding video chunks and returning video frames.
 */
export class Audio {
	#decoder;
	#decoderConfig: AudioDecoderConfig | null = null;
	//#ready = false;
	#running = false;

	ringBuffer: RingBuffer | undefined;

	/** all chunks */
	#chunks: EncodedAudioChunk[] = [];
	/** chunks waiting to be decoded */
	#chunkBuffer: EncodedAudioChunk[] = [];
	#audioDataQueue: AudioData[] = [];

	#lastChunkIndex = 0;
	#lastAudioDataTimestamp = 0;
	#feedingPaused = false;

	#currentBatchFrames = 0;
	#currentSampleIndex = 0;
	batchAccumulator: Float32Array[] = [];

	//#decoderOutputArray = new Float32Array(1024);

	constructor() {
		this.#decoder = new AudioDecoder({ output: this.#onOutput, error: this.#onError });
	}

	setup(config: AudioDecoderConfig, chunks: EncodedAudioChunk[]) {
		this.#decoderConfig = config;
		this.#decoder.configure(this.#decoderConfig);
		this.#chunks = chunks;
		//this.#ready = true;

		// Initialize the ring buffer between the decoder and the real-time audio
		// rendering thread. The AudioRenderer has buffer space for approximately
		// 500ms of decoded audio ahead.
		const sampleCountIn500ms =
			DATA_BUFFER_DURATION * this.#decoderConfig.sampleRate * this.#decoderConfig.numberOfChannels;
		const sab = RingBuffer.getStorageForCapacity(sampleCountIn500ms, Float32Array);
		this.ringBuffer = new RingBuffer(sab, Float32Array);

		return sab;
	}

	play(/* frameNumber: number */) {
		if (this.#running) return;
		this.#running = true;

		//const frameTimestamp = Math.floor(frameNumber * 33333.3333333) + 33333 / 2;
		//const { targetFrameIndex, keyFrameIndex } = this.#getKeyFrameIndex(frameTimestamp);

		//this.#startingFrameTimeStamp = this.#chunks[targetFrameIndex].timestamp;

		this.#chunkBuffer = [];
		for (let i = 0; i < 10; i++) {
			this.#chunkBuffer.push(this.#chunks[i]);
			this.#lastChunkIndex = i;
		}
		this.#feedDecoder();
	}

	run(elapsedTimeMs: number) {
		const elapsedMicroSeconds = Math.floor(elapsedTimeMs * 1000);

		//console.log('current -> ', elapsedMicroSeconds);
		//console.log('latest -> ', this.#lastAudioDataTimestamp);

		if (elapsedMicroSeconds + 3e6 < this.#lastAudioDataTimestamp) {
			// more that three seconds of audio buffer
			//return;
		}

		let minTimeDelta = Infinity;
		//let audioDataIndex = -1;
		for (let i = 0; i < this.#audioDataQueue.length; i++) {
			const time_delta = Math.abs(elapsedMicroSeconds - this.#audioDataQueue[i].timestamp);
			if (time_delta < minTimeDelta) {
				minTimeDelta = time_delta;
				//	audioDataIndex = i;
			} else {
				break;
			}
		}
		//const chosenAudioData = this.#audioDataQueue[audioDataIndex];
		//if (chosenAudioData) console.log('got -> ', this.#audioDataQueue[audioDataIndex].timestamp);
		//for (let i = 0; i < 2; i++) {
		const chunk = new Float32Array(1024 * 2);

		for (let i = 0; i < 1024; i++) {
			const globalSampleTime = (this.#currentSampleIndex + i) / 48000;
			const sampleValue = 0.5 * Math.sin(2 * Math.PI * 440 * globalSampleTime);

			// Populate stereo channels with the same sine wave
			chunk[i * 2] = sampleValue; // Left channel
			chunk[i * 2 + 1] = sampleValue; // Right channel
		}
		this.batchAccumulator.push(chunk);
		this.#currentBatchFrames += AUDIO_CHUNK_FRAMES;
		this.#currentSampleIndex += AUDIO_CHUNK_FRAMES; // Advance global sample index

		// 3. Check if the batch is full and send it
		if (this.#currentBatchFrames >= BATCH_FRAMES) {
			const combinedBatchBuffer = new Float32Array(this.#currentBatchFrames * 2);

			let offset = 0;
			for (const chunk of this.batchAccumulator) {
				combinedBatchBuffer.set(chunk, offset); // Copy chunk into the combined buffer
				offset += chunk.length; // Advance offset by number of samples in the chunk
			}

			// Send the combined ArrayBuffer to the main thread as a transferable
			self.postMessage(
				{
					command: 'audio-chunk', // New message type for batches
					audioData: combinedBatchBuffer.buffer
				},
				{ transfer: [combinedBatchBuffer.buffer] }
				// Transfer the ArrayBuffer
			);

			// Clear the accumulator for the next batch
			this.batchAccumulator.length = 0; // Clear the array
			this.#currentBatchFrames = 0;
		}
		/* 	self.postMessage(
			{
				command: 'audio-chunk',
				audioData: chunkBuffer.buffer
			},
			{ transfer: [chunkBuffer.buffer] }
			// Make sure to list it as transferable!
		); */

		/* if (!this.ringBuffer) return;

		const enqueued = this.ringBuffer.push(chunkBuffer);

		console.log('queue -> ', enqueued);

		if (enqueued < chunkBuffer.length) {
			// This indicates the main thread isn't consuming fast enough, or buffer is too small
			console.warn(
				`Worker: Ring buffer overflow! Only pushed ${enqueued} of ${chunkBuffer.length} samples. Buffer full: ${((this.ringBuffer.availableWrite() / this.ringBuffer.capacity()) * 100).toFixed(2)}%`
			);
		}

		this.#currentSampleIndex += 1024; */
		//	}

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
			//const numberOfFrames = audioData.numberOfFrames;
			this.#audioDataQueue.push(audioData);
			this.#lastAudioDataTimestamp = audioData.timestamp;
			/* audioData.copyTo(this.#decoderOutputArray, {
				planeIndex: 0
			});
			let enqueued = 0;
			if (this.ringBuffer)
				enqueued = this.ringBuffer.push(this.#decoderOutputArray.subarray(0, numberOfFrames));
			if (enqueued < numberOfFrames) {
				console.warn(`Ring buffer overflow! Dropped ${numberOfFrames - enqueued} frames.`);
			}
			//console.log(enqueued);
			audioData.close(); */
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
					this.#audioDataQueue.length,
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
