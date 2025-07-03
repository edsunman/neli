/*
 *   Control audio playback on main thread at appstate.audioManager
 *
 */
export class AudioMananger {
	#audioContext;
	#gainNode: GainNode | null = null;
	#currentOffset = 0;
	#audioQueue: Float32Array[] = [];

	constructor() {
		this.#audioContext = new AudioContext();
	}

	push(f32Array: Float32Array) {
		this.#audioQueue.push(f32Array);
	}

	play() {
		this.#currentOffset = this.#audioContext.currentTime;
		this.#gainNode = this.#audioContext.createGain();
		this.#gainNode.gain.value = 1; // Master volume
		this.#gainNode.connect(this.#audioContext.destination);
	}

	run() {
		//console.log('available read ', appState.audioRingBuffer?.availableRead());

		//const samplesRead = appState.audioRingBuffer?.pop(f32array);

		if (this.#audioQueue.length > 0) {
			const receivedFloat32Data = this.#audioQueue.shift();
			//console.log(receivedFloat32Data);
			if (!receivedFloat32Data) return;

			const framesRead = receivedFloat32Data.length / 2;
			//console.log('framesRead', framesRead);
			const audioBuffer = this.#audioContext.createBuffer(
				2, // Use the global CHANNELS variable (e.g., 2 for stereo)
				framesRead,
				this.#audioContext.sampleRate
			);
			//console.log(audioBuffer);

			//console.log(audioBuffer.length, audioBuffer.duration);

			const leftChannelData = audioBuffer.getChannelData(0);
			for (let i = 0; i < framesRead; i++) {
				leftChannelData[i] = receivedFloat32Data[i * 2];
			}

			const rightChannelData = audioBuffer.getChannelData(1);
			for (let i = 0; i < framesRead; i++) {
				rightChannelData[i] = receivedFloat32Data[i * 2 + 1];
			}

			//audioBuffer.getChannelData(0).set(receivedFloat32Data.subarray(0, framesRead));

			const source = this.#audioContext.createBufferSource();
			source.buffer = audioBuffer;
			if (this.#gainNode) source.connect(this.#gainNode);

			const scheduledTime = Math.max(this.#audioContext.currentTime, this.#currentOffset);
			source.start(scheduledTime);
			this.#currentOffset = scheduledTime + audioBuffer.duration;
			//console.log(`current time: ${audioContext.currentTime} scheduled time : ${currentOffset}`);
			//console.log(
			//	`Main: Scheduled chunk. Remaining in queue: ${audioQueue.length} Current offset: ${currentOffset}`
			//);
		}
	}

	pause() {
		if (this.#gainNode) this.#gainNode.disconnect();
		this.#gainNode = null;
	}
}
