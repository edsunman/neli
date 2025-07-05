/*
 *   Controls audio playback on main thread
 */
export class AudioMananger {
	audioLevel = $state(0);

	#audioContext;
	#gainNode: GainNode | null = null;
	#analyserNode: AnalyserNode;
	#currentOffset = 0;
	#audioQueue: Float32Array[] = [];
	#dataArray = new Float32Array(1024);

	constructor() {
		this.#audioContext = new AudioContext();
		this.#analyserNode = this.#audioContext.createAnalyser();
		this.#analyserNode.connect(this.#audioContext.destination);
		this.#analyserNode.fftSize = 1024;
		this.#analyserNode.smoothingTimeConstant = 1;
	}

	push(f32Array: Float32Array) {
		this.#audioQueue.push(f32Array);
	}

	play() {
		this.#currentOffset = this.#audioContext.currentTime;
		this.#gainNode = this.#audioContext.createGain();
		this.#gainNode.gain.value = 1; // Master volume
		this.#gainNode.connect(this.#analyserNode);
	}

	run() {
		this.#updateMeter();
		if (this.#audioQueue.length > 0) {
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
		}
	}

	pause() {
		if (this.#gainNode) this.#gainNode.disconnect();
		this.#gainNode = null;
		this.audioLevel = 0;
	}

	#updateMeter() {
		this.#analyserNode.getFloatTimeDomainData(this.#dataArray); // Get data as floats (-1.0 to 1.0)

		let peakAmplitude = 0;

		for (let i = 0; i < this.#dataArray.length; i++) {
			const sample = this.#dataArray[i];
			const absSample = Math.abs(sample); // Get the absolute value
			if (absSample > peakAmplitude) {
				peakAmplitude = absSample; // Update if a new peak is found
			}
		}

		const MIN_METER_DB = -100; // Bar will be 0% at this dB level
		const MAX_METER_DB = 0; // Bar will be 100% at this dB level

		// Convert peak amplitude to dB (eg -6 dbPeak === -6 dB)
		const dbPeak = 20 * Math.log10(peakAmplitude + 0.00001);

		// Normalise between 0 and 1
		let normalisedDbForVisual = (dbPeak - MIN_METER_DB) / (MAX_METER_DB - MIN_METER_DB);
		normalisedDbForVisual = Math.max(0, Math.min(1, normalisedDbForVisual));

		// Apply non linear curve so -6 is about 0.8
		const peakValue = Math.pow(normalisedDbForVisual, 3);

		if (peakValue > this.audioLevel) {
			this.audioLevel = peakValue;
		} else {
			this.audioLevel = this.audioLevel - 0.01;
		}
	}
}
