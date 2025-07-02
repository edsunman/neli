const DEBUG = false;
const AUDIO_CHUNK_FRAMES = 1024;
const BATCH_FRAMES_TARGET = AUDIO_CHUNK_FRAMES * 8; // Send 4 'internal' chunks at once

/**
 * Responsible for demuxing and storing video chunks, then
 * decoding video chunks and returning video frames.
 */
export class Audio {
	#decoder;
	#decoderConfig: AudioDecoderConfig | null = null;
	//#ready = false;
	#running = false;

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
	batchAccumulator: AudioData[] = [];

	//#decoderOutputArray = new Float32Array(1024);

	constructor() {
		this.#decoder = new AudioDecoder({ output: this.#onOutput, error: this.#onError });
	}

	setup(config: AudioDecoderConfig, chunks: EncodedAudioChunk[]) {
		this.#decoderConfig = config;
		this.#decoder.configure(this.#decoderConfig);
		this.#chunks = chunks;
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

		for (let i = 0; i < this.#audioDataQueue.length; i++) {
			const time_delta = Math.abs(elapsedMicroSeconds - this.#audioDataQueue[i].timestamp);
			if (time_delta < minTimeDelta) {
				minTimeDelta = time_delta;
				//	audioDataIndex = i;
			} else {
				break;
			}
		}

		/*	const chunk = new Float32Array(1024 * 2);

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
		} */

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
			console.log(audioData.numberOfFrames);
			this.batchAccumulator.push(audioData);
			this.#lastAudioDataTimestamp = audioData.timestamp;
			this.#currentBatchFrames += audioData.numberOfFrames;

			if (this.#currentBatchFrames >= BATCH_FRAMES_TARGET) {
				console.log('lets go');
				const combinedBatchBuffer = new Float32Array(this.#currentBatchFrames * 2);

				let offset = 0;
				for (const audioData of this.batchAccumulator) {
					// Copy data from each AudioData object into the combined buffer
					for (let i = 0; i < 2; i++) {
						const planarData = new Float32Array(audioData.numberOfFrames); // Temporary buffer for one channel
						audioData.copyTo(planarData, {
							planeIndex: i,
							frameOffset: 0,
							frameCount: audioData.numberOfFrames
						});

						// Interleave into the combinedBatchBuffer
						for (let j = 0; j < audioData.numberOfFrames; j++) {
							combinedBatchBuffer[offset + j * 2 + i] = planarData[j];
						}
					}
					// IMPORTANT: Close the AudioData object after copying its data!
					offset += audioData.numberOfFrames * 2; // Advance offset by total samples of the copied AudioData
					audioData.close();
				}
				self.postMessage(
					{
						command: 'audio-chunk', // New message type for batches
						audioData: combinedBatchBuffer.buffer
					},
					{ transfer: [combinedBatchBuffer.buffer] }
					// Transfer the ArrayBuffer
				);
				this.batchAccumulator.length = 0;
				this.#currentBatchFrames = 0;
			}
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
