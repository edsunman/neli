import type { Clip } from '$lib/clip/clip.svelte';
import { appState, audioDecoder, audioState, timelineState } from '$lib/state.svelte';

export const runAudio = (frame: number, elapsedTimeMs: number) => {
	// run decoders
	const currentClips: Clip[] = [];
	for (const clip of timelineState.clips) {
		if (clip.deleted) continue;
		if (clip.start <= frame && clip.start + clip.duration > frame) {
			currentClips.push(clip);
			if (audioState.playingClips.find((c) => c === clip.id)) {
				// already playing so run
				audioState.decoderPool.runDecoder(clip.id, elapsedTimeMs);
			} else {
				// not yet playing so play
				const clipFrame = frame - clip.start + clip.sourceOffset;

				setupNewDecoder(clip);
				audioState.decoderPool.playDecoder(clip.id, clipFrame);
				audioState.playingClips.push(clip.id);

				const gainNode = audioState.audioContext.createGain();
				// TODO: create master gain
				gainNode.connect(audioState.splitterNode);
				gainNode.connect(audioState.audioContext.destination);
				audioState.gainNodes.set(clip.id, gainNode);

				audioState.offsets.set(clip.id, audioState.audioContext.currentTime);
			}
		}
		// look ahead
		if (frame < clip.start && frame > clip.start - 4) {
			//const frameDistance = clip.start - frame;
			//console.log(`clip starts in ${frameDistance} frames`);
		}
	}

	// stop decoders
	for (let i = audioState.playingClips.length - 1; i >= 0; i--) {
		if (!currentClips.find((c) => c.id === audioState.playingClips[i])) {
			// clip no longer playing so stop
			audioState.decoderPool.pauseDecoder(audioState.playingClips[i]);

			audioState.gainNodes.get(audioState.playingClips[i])?.disconnect();
			audioState.gainNodes.delete(audioState.playingClips[i]);
			audioState.offsets.delete(audioState.playingClips[i]);

			audioState.playingClips.splice(i, 1);
		}
	}

	// play audio in decoder buffers
	for (const [clipId, decoder] of audioState.decoderPool.decoders) {
		if (decoder.running && decoder.audioDataQueue.length > 4) {
			let currentBatchFrames = 0;
			for (const audioData of decoder.audioDataQueue) {
				currentBatchFrames += audioData.numberOfFrames;
			}
			const combinedBatchBuffer = new Float32Array(currentBatchFrames * 2);
			let offset = 0;
			for (const audioData of decoder.audioDataQueue) {
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
			decoder.audioDataQueue.length = 0;

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

			const gainNode = audioState.gainNodes.get(clipId);
			if (gainNode) source.connect(gainNode);

			const currentOffset = audioState.offsets.get(clipId);
			let scheduledTime = audioState.audioContext.currentTime;

			if (currentOffset) {
				scheduledTime = Math.max(audioState.audioContext.currentTime, currentOffset);
			}
			source.start(scheduledTime);

			audioState.offsets.set(clipId, scheduledTime + audioBuffer.duration);
		}
	}

	updateMeter();
};

export const pauseAudio = () => {
	audioState.decoderPool.pauseAll();
	audioState.gainNodes.forEach((node) => {
		if (node) node.disconnect();
	});
	audioState.gainNodes.clear();
	audioState.offsets.clear();

	audioState.playingClips.length = 0;
	appState.audioLevel = [0, 0];
};

const setupNewDecoder = (clip: Clip) => {
	const source = appState.sources.find((s) => s.id === clip.source.id);
	if (!source || !source.audioConfig) return;
	const decoder = audioState.decoderPool.assignDecoder(clip.id);
	if (!decoder) return;
	decoder.setup(source.audioConfig, source.audioChunks);
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
