import { audioDecoder } from '$lib/state.svelte';

// return float 32 array to send to worker
export const renderAudio = async () => {
	const sampleRate = 48000; // Standard sample rate
	const duration = 10; // seconds
	const numberOfChannels = 2; // Stereo
	const totalFrames = duration * sampleRate;

	// Create an OfflineAudioContext
	const offlineAudioContext = new OfflineAudioContext(
		numberOfChannels,
		sampleRate * duration,
		sampleRate
	);

	const masterAudioBuffer = offlineAudioContext.createBuffer(
		numberOfChannels,
		totalFrames,
		sampleRate
	);

	await decodeSource(masterAudioBuffer);

	// Create a gain node
	//const gainNode = offlineAudioContext.createGain();
	//gainNode.gain.value = 0.5;

	const source = offlineAudioContext.createBufferSource();
	source.buffer = masterAudioBuffer;
	source.connect(offlineAudioContext.destination);

	source.start(0);

	// Start rendering and await the result
	const renderedBuffer = await offlineAudioContext.startRendering();

	const combinedPlanarBufferForTransfer = new Float32Array(
		sampleRate * duration * numberOfChannels
	);
	let offset = 0;
	// This 'concatenation' for transfer means: [Channel0Data | Channel1Data | Channel2Data ...]
	// The worker will know how to split this back based on numberOfChannels and frames.
	for (let c = 0; c < numberOfChannels; c++) {
		combinedPlanarBufferForTransfer.set(renderedBuffer.getChannelData(c), offset);
		offset += sampleRate * duration; // Advance by full channel length
	}

	return combinedPlanarBufferForTransfer;
};

const decodeSource = async (audioBuffer: AudioBuffer) => {
	let resolver: (value: boolean | PromiseLike<boolean>) => void;
	const promise = new Promise<boolean>((resolve) => {
		resolver = resolve;
	});

	audioDecoder.play(0);

	//let i = 0;
	let currentWriteOffset = 0;
	let done = false;
	const decodeLoop = async () => {
		audioDecoder.run(0, true);

		for (let i = 1; i < audioDecoder.audioDataQueue.length; i++) {
			//console.log(`length is ${audioDecoder.audioDataQueue.length} so lets go for it`);
			const audioData = audioDecoder.audioDataQueue.shift();
			if (!audioData) continue;

			for (let c = 0; c < audioData.numberOfChannels; c++) {
				const finalBufferChannelData = audioBuffer.getChannelData(c); // Get view from master AudioBuffer

				const destinationSlice = finalBufferChannelData.subarray(
					currentWriteOffset,
					currentWriteOffset + audioData.numberOfFrames
				);

				audioData.copyTo(destinationSlice, {
					planeIndex: c,
					frameCount: audioData.numberOfFrames
				});
			}
			currentWriteOffset += audioData.numberOfFrames;
			console.log(
				`current write offset: ${currentWriteOffset}, trying to copy: ${audioData.numberOfFrames}, total length: ${audioBuffer.length}`
			);
			audioData.close();
			if (currentWriteOffset + 1024 > audioBuffer.length - 1024) {
				done = true;
				break;
			}
		}

		if (!done) {
			setTimeout(decodeLoop, 0);
		} else {
			console.log('done');
			resolver(true);
		}
	};
	decodeLoop();

	return promise;
};
