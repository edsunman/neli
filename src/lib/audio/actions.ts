import { appState, audioDecoder, audioState } from '$lib/state.svelte';

export const playAudio = () => {
	audioState.currentOffset = audioState.audioContext.currentTime;

	// create audio nodes
	audioState.gainNode = audioState.audioContext.createGain();
	audioState.gainNode.connect(audioState.splitterNode);
	audioState.gainNode.connect(audioState.audioContext.destination);
};

export const runAudio = () => {
	updateMeter();
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
		const audioBuffer = audioState.audioContext.createBuffer(
			2,
			currentBatchFrames,
			audioState.audioContext.sampleRate
		);

		const leftChannelData = audioBuffer.getChannelData(0);
		for (let i = 0; i < framesRead; i++) {
			leftChannelData[i] = combinedBatchBuffer[i * 2];
		}

		const rightChannelData = audioBuffer.getChannelData(1);
		for (let i = 0; i < framesRead; i++) {
			rightChannelData[i] = combinedBatchBuffer[i * 2 + 1];
		}

		const source = audioState.audioContext.createBufferSource();
		source.buffer = audioBuffer;
		if (audioState.gainNode) source.connect(audioState.gainNode);

		const scheduledTime = Math.max(audioState.audioContext.currentTime, audioState.currentOffset);
		source.start(scheduledTime);

		audioState.currentOffset = scheduledTime + audioBuffer.duration;
	}
};

export const pauseAudio = () => {
	if (audioState.gainNode) audioState.gainNode.disconnect();
	audioState.gainNode = null;
	appState.audioLevel = [0, 0];
};

const updateMeter = () => {
	const MIN_METER_DB = -100; // Bar will be 0% at this dB level

	audioState.analyserNodeLeft.getFloatTimeDomainData(audioState.dummyF32Array);

	// Left channel
	let peakAmplitude = 0;
	for (let i = 0; i < audioState.dummyF32Array.length; i++) {
		const sample = audioState.dummyF32Array[i];
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

	if (peakValueL > appState.audioLevel[0]) {
		appState.audioLevel[0] = peakValueL;
	} else {
		appState.audioLevel[0] = appState.audioLevel[0] - 0.02;
	}

	// Right channel
	audioState.analyserNodeRight.getFloatTimeDomainData(audioState.dummyF32Array);

	peakAmplitude = 0;
	for (let i = 0; i < audioState.dummyF32Array.length; i++) {
		const sample = audioState.dummyF32Array[i];
		const absSample = Math.abs(sample);
		if (absSample > peakAmplitude) {
			peakAmplitude = absSample;
		}
	}

	dbPeak = 20 * Math.log10(peakAmplitude + 0.00001);
	normalisedDbForVisual = (dbPeak - MIN_METER_DB) / (0 - MIN_METER_DB);
	normalisedDbForVisual = Math.max(0, Math.min(1, normalisedDbForVisual));
	const peakValueR = Math.pow(normalisedDbForVisual, 3);

	if (peakValueR > appState.audioLevel[1]) {
		appState.audioLevel[1] = peakValueR;
	} else {
		appState.audioLevel[1] = appState.audioLevel[1] - 0.02;
	}
};

// Generate float 32 array to send to worker
export const renderAudio = async () => {
	const sampleRate = 48000;
	const duration = 10;
	const numberOfChannels = 2;
	const totalFrames = duration * sampleRate;

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
