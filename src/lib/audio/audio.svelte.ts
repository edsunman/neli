import { audioDecoder } from '$lib/state.svelte';

/*
 *   Controls audio playback on main thread
 */
export class AudioMananger {
	audioLevel = $state([0, 0]);

	#audioContext;

	#gainNode: GainNode | null = null;
	#analyserNodeLeft: AnalyserNode;
	#analyserNodeRight: AnalyserNode;
	#splitterNode: ChannelSplitterNode;

	#currentOffset = 0;
	#audioQueue: Float32Array[] = [];
	#dataArrayLeft = new Float32Array(1024);
	#dataArrayRight = new Float32Array(1024);

	constructor() {
		this.#audioContext = new AudioContext();

		this.#analyserNodeLeft = this.#audioContext.createAnalyser();
		this.#analyserNodeLeft.fftSize = 1024;
		this.#analyserNodeRight = this.#audioContext.createAnalyser();
		this.#analyserNodeRight.fftSize = 1024;
		//this.#analyserNode.smoothingTimeConstant = 1;

		this.#splitterNode = this.#audioContext.createChannelSplitter();
		this.#splitterNode.connect(this.#analyserNodeLeft, 0);
		this.#splitterNode.connect(this.#analyserNodeRight, 1);
	}

	push(f32Array: Float32Array) {
		this.#audioQueue.push(f32Array);
	}

	play() {
		this.#currentOffset = this.#audioContext.currentTime;
		this.#gainNode = this.#audioContext.createGain();
		this.#gainNode.gain.value = 1; // Master volume
		this.#gainNode.connect(this.#splitterNode);
		this.#gainNode.connect(this.#audioContext.destination);
	}

	run() {
		this.#updateMeter();
		if (audioDecoder.audioDataQueue.length > 4) {
			let currentBatchFrames = 0;
			for (const audioData of audioDecoder.audioDataQueue) {
				currentBatchFrames += audioData.numberOfFrames;
			}
			const combinedBatchBuffer = new Float32Array(currentBatchFrames * 2);
			let offset = 0;
			for (const audioData of audioDecoder.audioDataQueue) {
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
			audioDecoder.audioDataQueue.length = 0;

			const framesRead = currentBatchFrames;
			const audioBuffer = this.#audioContext.createBuffer(
				2,
				currentBatchFrames,
				this.#audioContext.sampleRate
			);

			const leftChannelData = audioBuffer.getChannelData(0);
			for (let i = 0; i < framesRead; i++) {
				leftChannelData[i] = combinedBatchBuffer[i * 2];
			}

			const rightChannelData = audioBuffer.getChannelData(1);
			for (let i = 0; i < framesRead; i++) {
				rightChannelData[i] = combinedBatchBuffer[i * 2 + 1];
			}

			const source = this.#audioContext.createBufferSource();
			source.buffer = audioBuffer;
			if (this.#gainNode) source.connect(this.#gainNode);

			const scheduledTime = Math.max(this.#audioContext.currentTime, this.#currentOffset);
			source.start(scheduledTime);

			this.#currentOffset = scheduledTime + audioBuffer.duration;
		}
		/*if (this.#audioQueue.length > 0) {
			const receivedFloat32Data = this.#audioQueue.shift();
			if (!receivedFloat32Data) return;

			const framesRead = receivedFloat32Data.length / 2;
			const audioBuffer = this.#audioContext.createBuffer(
				2,
				framesRead,
				this.#audioContext.sampleRate
			);

			const leftChannelData = audioBuffer.getChannelData(0);
			for (let i = 0; i < framesRead; i++) {
				leftChannelData[i] = receivedFloat32Data[i * 2];
			}

			const rightChannelData = audioBuffer.getChannelData(1);
			for (let i = 0; i < framesRead; i++) {
				rightChannelData[i] = receivedFloat32Data[i * 2 + 1];
			}

			const source = this.#audioContext.createBufferSource();
			source.buffer = audioBuffer;
			if (this.#gainNode) source.connect(this.#gainNode);

			const scheduledTime = Math.max(this.#audioContext.currentTime, this.#currentOffset);
			source.start(scheduledTime);

			this.#currentOffset = scheduledTime + audioBuffer.duration;
		}*/
	}

	pause() {
		if (this.#gainNode) this.#gainNode.disconnect();
		this.#gainNode = null;
		this.audioLevel = [0, 0];
	}

	#updateMeter() {
		const MIN_METER_DB = -100; // Bar will be 0% at this dB level

		this.#analyserNodeLeft.getFloatTimeDomainData(this.#dataArrayLeft);
		this.#analyserNodeRight.getFloatTimeDomainData(this.#dataArrayRight);

		// left channel
		let peakAmplitude = 0;
		for (let i = 0; i < this.#dataArrayLeft.length; i++) {
			const sample = this.#dataArrayLeft[i];
			const absSample = Math.abs(sample);
			if (absSample > peakAmplitude) {
				peakAmplitude = absSample;
			}
		}
		// Convert peak amplitude to dB (eg -6 dbPeak === -6 dB)
		let dbPeak = 20 * Math.log10(peakAmplitude + 0.00001);
		// Normalise between 0 and 1
		let normalisedDbForVisual = (dbPeak - MIN_METER_DB) / (0 - MIN_METER_DB);
		normalisedDbForVisual = Math.max(0, Math.min(1, normalisedDbForVisual));
		// Apply non linear curve so -6 is about 0.8
		const peakValueL = Math.pow(normalisedDbForVisual, 3);

		if (peakValueL > this.audioLevel[0]) {
			this.audioLevel[0] = peakValueL;
		} else {
			this.audioLevel[0] = this.audioLevel[0] - 0.02;
		}

		// right channel
		peakAmplitude = 0;
		for (let i = 0; i < this.#dataArrayRight.length; i++) {
			const sample = this.#dataArrayRight[i];
			const absSample = Math.abs(sample);
			if (absSample > peakAmplitude) {
				peakAmplitude = absSample;
			}
		}

		dbPeak = 20 * Math.log10(peakAmplitude + 0.00001);
		normalisedDbForVisual = (dbPeak - MIN_METER_DB) / (0 - MIN_METER_DB);
		normalisedDbForVisual = Math.max(0, Math.min(1, normalisedDbForVisual));
		const peakValueR = Math.pow(normalisedDbForVisual, 3);

		if (peakValueR > this.audioLevel[1]) {
			this.audioLevel[1] = peakValueR;
		} else {
			this.audioLevel[1] = this.audioLevel[1] - 0.02;
		}
	}
}
