import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source.svelte';
import { appState, audioState, timelineState } from '$lib/state.svelte';

export const runAudio = (frame: number, elapsedTimeMs: number) => {
	// run decoders
	const currentClips: Clip[] = [];
	for (const clip of timelineState.clips) {
		if (clip.deleted || clip.source.type === 'text') continue;
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

				const panNode = audioState.audioContext.createStereoPanner();
				panNode.pan.value = clip.params[5];
				panNode.connect(audioState.masterGainNode);
				audioState.panNodes.set(clip.id, panNode);

				const gainNode = audioState.audioContext.createGain();
				gainNode.gain.value = clip.params[4];
				gainNode.connect(panNode);
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
		const clip = audioState.playingClips[i];
		if (!currentClips.find((c) => c.id === clip)) {
			// clip no longer playing so stop
			audioState.decoderPool.pauseDecoder(clip);

			audioState.panNodes.get(clip)?.disconnect();
			audioState.panNodes.delete(clip);
			audioState.gainNodes.get(clip)?.disconnect();
			audioState.gainNodes.delete(clip);
			audioState.offsets.delete(clip);
			audioState.testTones.delete(clip);

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
						format: 'f32-planar',
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
				decoder.sampleRate
			);

			const leftChannelData = audioBuffer.getChannelData(0);
			for (let i = 0; i < framesRead; i++) {
				leftChannelData[i] = combinedBatchBuffer[i * 2];
			}

			const rightChannelData = audioBuffer.getChannelData(1);
			for (let i = 0; i < framesRead; i++) {
				rightChannelData[i] = combinedBatchBuffer[i * 2 + 1];
			}

			const sourceNode = audioState.audioContext.createBufferSource();
			sourceNode.buffer = audioBuffer;

			const gainNode = audioState.gainNodes.get(clipId);
			if (gainNode) sourceNode.connect(gainNode);

			const currentOffset = audioState.offsets.get(clipId);
			let scheduledTime = audioState.audioContext.currentTime;

			if (currentOffset) {
				scheduledTime = Math.max(audioState.audioContext.currentTime, currentOffset);
			}
			sourceNode.start(scheduledTime);

			audioState.offsets.set(clipId, scheduledTime + audioBuffer.duration);
		}
	}

	for (const clip of currentClips) {
		if (clip.source.type !== 'test') continue;

		const nextMultiple = Math.ceil((frame - clip.start + 15) / 30) * 30 - 15;

		const nextToneFrame = audioState.testTones.get(clip.id);
		if (!nextToneFrame || nextToneFrame !== nextMultiple) {
			audioState.testTones.set(clip.id, nextMultiple);

			const sampleRate = audioState.audioContext.sampleRate;

			const duration = 2 / 30;
			const frameCount = audioState.audioContext.sampleRate * duration;

			const buffer = audioState.audioContext.createBuffer(1, frameCount, sampleRate);

			const bufferData = buffer.getChannelData(0); // get the first channel
			const frequency = ((nextMultiple - 15) / 30) % 4 === 0 ? 880 : 440; // A4 in Hz
			const fadeDuration = 0.0005;
			const fadeFrames = sampleRate * fadeDuration;
			const amplitude = 1;
			for (let i = 0; i < frameCount; i++) {
				const time = i / sampleRate;
				let gain = 1;
				if (i > frameCount - fadeFrames) {
					gain = (frameCount - i) / fadeFrames;
				}
				bufferData[i] = gain * amplitude * Math.sin(2 * Math.PI * frequency * time);
			}

			const sourceNode = audioState.audioContext.createBufferSource();
			sourceNode.buffer = buffer;

			const gainNode = audioState.gainNodes.get(clip.id);
			if (gainNode) sourceNode.connect(gainNode);
			sourceNode.start(
				audioState.audioContext.currentTime + (nextMultiple - (frame - clip.start)) / 30
			);
		}
	}

	updateMeter();
};

export const pauseAudio = () => {
	audioState.decoderPool.pauseAll();
	audioState.panNodes.forEach((node) => {
		if (node) node.disconnect();
	});
	audioState.panNodes.clear();
	audioState.gainNodes.forEach((node) => {
		if (node) node.disconnect();
	});
	audioState.gainNodes.clear();
	audioState.offsets.clear();
	audioState.testTones.clear();

	audioState.playingClips.length = 0;
	appState.audioLevel = [0, 0];
};

const setupNewDecoder = (clip: Clip) => {
	const source = appState.sources.find((s) => s.id === clip.source.id);
	if (!source || !source.audioConfig) return;
	const decoder = audioState.decoderPool.assignDecoder(clip.id);
	if (!decoder) return;
	decoder.setup(source.audioConfig, source.audioChunks);
	return decoder;
};

const updateMeter = () => {
	const MIN_METER_DB = -60; // Bar will be 0% at this dB level

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

	// TODO: show clipping on meter
	//if (dbPeak > 1) console.log('clip');

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

export const generateWaveformData = async (source: Source) => {
	let resolve: (value: boolean) => void;
	const promise = new Promise((res) => {
		resolve = res;
	});

	if (!source.audioConfig || !source.duration || !source.frameRate) return;
	// We are going to store 300 values per second to draw waveform
	// The step is how many samples we need per value
	const step = source.audioConfig.sampleRate / 300;

	const durationInSeconds = source.duration / source.frameRate;
	// Array needs to be big enough to hold 300 samples per second
	const data = new Float32Array(durationInSeconds * 300);

	const decoder = audioState.decoderPool.assignDecoder(source.id);
	if (!decoder) return;
	decoder.setup(source.audioConfig, source.audioChunks);
	decoder.play(0);

	let count = 0;
	const state = {
		currentIndex: 0,
		samplesRemaining: 0,
		previousMax: 0,
		tempSamples: []
	};
	const decodeLoop = async () => {
		decoder.run(0, true);

		for (let i = 1; i < decoder.audioDataQueue.length; i++) {
			const audioData = decoder.audioDataQueue.shift();
			if (!audioData) continue;

			const numberOfAudioDataSamples = audioData.numberOfFrames;
			const rawData = new Float32Array(numberOfAudioDataSamples);

			audioData.copyTo(rawData, {
				format: 'f32-planar',
				planeIndex: 0,
				frameOffset: 0
			});

			processAudioChunk(rawData, step, state, data);
			audioData.close();
			count++;
		}

		if (count < source.audioChunks.length - 2) {
			setTimeout(decodeLoop, 0);
		} else {
			source.audioWaveform = data;
			timelineState.invalidateWaveform = true;
			resolve(true);
		}
	};
	decodeLoop();
	return promise;
};

const processAudioChunk = (
	rawData: Float32Array,
	step: number,
	state: {
		currentIndex: number;
		samplesRemaining: number;
		previousMax: number;
		tempSamples: number[];
	},
	data: Float32Array
) => {
	const currentData = [...state.tempSamples, ...rawData];
	const totalSamples = currentData.length;

	// Process all full steps in the current combined data
	for (let i = 0; i <= totalSamples - step; i += step) {
		let max = 0;
		for (let j = 0; j < step; j++) {
			const absValue = Math.abs(currentData[i + j]);
			if (absValue > max) {
				max = absValue;
			}
		}
		data[state.currentIndex] = max;
		state.currentIndex++;
	}

	// Determine how many samples are left over
	const remainingStartIndex = Math.floor(totalSamples / step) * step;
	const samplesRemaining = totalSamples - remainingStartIndex;

	// Store the remaining samples and their max value for the next chunk
	if (samplesRemaining > 0) {
		let max = 0;
		const remainingSamples = currentData.slice(remainingStartIndex);
		for (const sample of remainingSamples) {
			const absValue = Math.abs(sample);
			if (absValue > max) {
				max = absValue;
			}
		}
		state.previousMax = max;
		state.tempSamples = remainingSamples;
		state.samplesRemaining = samplesRemaining;
	} else {
		// If there are no remaining samples, reset the state
		state.previousMax = 0;
		state.tempSamples = [];
		state.samplesRemaining = 0;
	}
};

/** Generate float 32 array to send to worker */
export const renderAudioForExport = async (startFrame: number, endFrame: number) => {
	const sampleRate = 48000;
	const durationInFrames = endFrame - startFrame;
	const durationInSeconds = durationInFrames / 30;
	const numberOfChannels = 2;

	const offlineAudioContext = new OfflineAudioContext(
		numberOfChannels,
		sampleRate * durationInSeconds,
		sampleRate
	);

	const masterGainNode = offlineAudioContext.createGain();
	masterGainNode.connect(offlineAudioContext.destination);
	masterGainNode.gain.value = audioState.masterGain;
	console.log(timelineState.clips);
	for (const clip of timelineState.clips) {
		if (
			clip.deleted ||
			clip.start + clip.duration < startFrame ||
			clip.start > endFrame ||
			(clip.source.type !== 'video' && clip.source.type !== 'audio')
		)
			continue;

		let sourceStartFrame = 0;
		let sourceDuration = 0;
		let startOverflow = 0;
		let endOverflow = 0;
		let scheduleStartFrame = 0;
		// source start
		if (clip.start < startFrame) {
			startOverflow = startFrame - clip.start;
			sourceStartFrame = startOverflow + clip.sourceOffset;
		}
		sourceStartFrame = startOverflow + clip.sourceOffset;
		// duration
		if (clip.start + clip.duration > endFrame) {
			endOverflow = clip.start + clip.duration - endFrame;
		}
		sourceDuration = clip.duration - startOverflow - endOverflow;
		const durationSeconds = sourceDuration / 30;
		// schedule start time
		if (clip.start > startFrame) {
			scheduleStartFrame = clip.start - startFrame;
		}
		const scheduleStartSeconds = scheduleStartFrame / 30;

		if (!clip.source.audioConfig) continue;
		const audioBuffer = offlineAudioContext.createBuffer(
			2,
			durationSeconds * clip.source.audioConfig.sampleRate,
			clip.source.audioConfig.sampleRate
		);

		await decodeSource(audioBuffer, clip, sourceStartFrame);

		const gainNode = offlineAudioContext.createGain();
		gainNode.gain.value = clip.params[4];
		gainNode.connect(masterGainNode);
		const panNode = offlineAudioContext.createStereoPanner();
		panNode.pan.value = clip.params[5];
		panNode.connect(gainNode);
		const source = offlineAudioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(panNode);

		source.start(scheduleStartSeconds);
	}

	const renderedBuffer = await offlineAudioContext.startRendering();
	const combinedPlanarBuffer = new Float32Array(sampleRate * durationInSeconds * numberOfChannels);

	// The audio goes into the buffer one channel after another, not interleaved
	let offset = 0;
	for (let c = 0; c < numberOfChannels; c++) {
		combinedPlanarBuffer.set(renderedBuffer.getChannelData(c), offset);
		offset += sampleRate * durationInSeconds; // Advance by full channel length
	}

	return combinedPlanarBuffer;
};

/** Decode a source into the audioBuffer starting at startFrame
 * NOTE: there may be a better way to do this... at the moment if multiple
 * clips use the same source it will be decoded mutltple times
 */
const decodeSource = async (audioBuffer: AudioBuffer, clip: Clip, startFrame: number) => {
	let resolver: (value: boolean | PromiseLike<boolean>) => void;
	const promise = new Promise<boolean>((resolve) => {
		resolver = resolve;
	});

	const decoder = setupNewDecoder(clip);
	if (!decoder) return;
	decoder.play(startFrame);

	let currentWriteOffset = 0;
	let done = false;
	let retries = 0;
	const maxRetries = 20;
	const decodeLoop = async () => {
		decoder.run(0, true);

		for (let i = 1; i <= decoder.audioDataQueue.length; i++) {
			retries = 0;

			const audioData = decoder.audioDataQueue.shift();
			if (!audioData) continue;

			for (let c = 0; c < audioData.numberOfChannels; c++) {
				const finalBufferChannelData = audioBuffer.getChannelData(c);

				const destinationSlice = finalBufferChannelData.subarray(
					currentWriteOffset,
					currentWriteOffset + audioData.numberOfFrames
				);

				audioData.copyTo(destinationSlice, {
					format: 'f32-planar',
					planeIndex: c,
					frameCount: audioData.numberOfFrames
				});
			}
			currentWriteOffset += audioData.numberOfFrames;
			/* console.log(
				`current write offset: ${currentWriteOffset}, trying to copy: ${audioData.numberOfFrames}, total length: ${audioBuffer.length}`
			); */
			const numberOfFrames = audioData.numberOfFrames;
			audioData.close();

			if (currentWriteOffset + numberOfFrames >= audioBuffer.length) {
				// buffer full
				done = true;
				break;
			}
		}

		if (decoder.audioDataQueue.length < 1) {
			console.log(`retries: ${retries}`);
			retries++;
			if (retries >= maxRetries) {
				// we sent in a buffer that was too big
				console.warn('audio decode loop hit max retries');
				done = true;
			}
		}

		if (done) {
			decoder.pause();
			resolver(true);
		} else {
			setTimeout(decodeLoop, 0);
		}
	};
	decodeLoop();

	return promise;
};
