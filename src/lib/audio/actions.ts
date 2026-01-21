import type { Clip } from '$lib/clip/clip.svelte';
import type { Source } from '$lib/source/source.svelte';
import { appState, audioState, programState, timelineState } from '$lib/state.svelte';

export const runAudio = (frame: number, elapsedTimeMs: number) => {
	if (!timelineState.playing) return;
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

				setupNewDecoder(clip.source, clip.id);
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
		//if (frame < clip.start && frame > clip.start - 4) {
		//const frameDistance = clip.start - frame;
		//console.log(`clip starts in ${frameDistance} frames`);
		//}
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

	scheduleDecoderBuffers();

	for (const clip of currentClips) {
		if (clip.source.type !== 'test') continue;

		const nextMultiple = Math.ceil((frame - clip.start + 15) / 30) * 30 - 15;

		const nextToneFrame = audioState.testTones.get(clip.id);
		if (!nextToneFrame || nextToneFrame !== nextMultiple) {
			audioState.testTones.set(clip.id, nextMultiple);

			const sampleRate = audioState.audioContext.sampleRate;
			const duration = 2 / 30;
			const frameCount = sampleRate * duration;
			const high = ((nextMultiple - 15) / 30) % 4 === 0;

			const f32 = generateTone(high, sampleRate, frameCount);
			const buffer = audioState.audioContext.createBuffer(1, frameCount, sampleRate);
			buffer.copyToChannel(f32, 0);

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

export const runSourceAudio = (frame: number, elapsedTimeMs: number) => {
	if (!programState.playing) return;
	// run decoders

	const source = appState.selectedSource;
	if (!source) return;
	if (audioState.playingClips.find((c) => c === source.id)) {
		// already playing so run
		audioState.decoderPool.runDecoder(source.id, elapsedTimeMs);
	} else {
		// not yet playing so play
		setupNewDecoder(source);

		let fps = 30;
		if (source.info.type === 'video') fps = source.info.frameRate;
		audioState.decoderPool.playDecoder(source.id, frame, fps);
		audioState.playingClips.push(source.id);

		const panNode = audioState.audioContext.createStereoPanner();
		panNode.pan.value = 0;
		panNode.connect(audioState.masterGainNode);
		audioState.panNodes.set(source.id, panNode);

		const gainNode = audioState.audioContext.createGain();
		gainNode.gain.value = 1;
		gainNode.connect(panNode);
		audioState.gainNodes.set(source.id, gainNode);

		audioState.offsets.set(source.id, audioState.audioContext.currentTime);
	}

	scheduleDecoderBuffers();
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

const setupNewDecoder = (source: Source, clipId?: string) => {
	//	const source = appState.sources.find((s) => s.id === clip.source.id);
	if (!source.audioConfig || !source.sink) return;
	const decoder = audioState.decoderPool.assignDecoder(clipId ? clipId : source.id);
	if (!decoder) return;
	decoder.setup(source.audioConfig, source.sink);
	return decoder;
};

const scheduleDecoderBuffers = () => {
	for (const [clipId, decoder] of audioState.decoderPool.decoders) {
		if (decoder.running && decoder.audioDataQueue.length > 4) {
			let totalFrames = 0;
			for (const audioData of decoder.audioDataQueue) {
				totalFrames += audioData.numberOfFrames;
			}

			const audioBuffer = audioState.audioContext.createBuffer(2, totalFrames, decoder.sampleRate);
			const leftChannel = audioBuffer.getChannelData(0);
			const rightChannel = audioBuffer.getChannelData(1);

			let frameOffset = 0;
			for (const audioData of decoder.audioDataQueue) {
				const count = audioData.numberOfFrames;
				audioData.copyTo(leftChannel.subarray(frameOffset, frameOffset + count), {
					format: 'f32-planar',
					planeIndex: 0
				});
				audioData.copyTo(rightChannel.subarray(frameOffset, frameOffset + count), {
					format: 'f32-planar',
					planeIndex: 1
				});
				frameOffset += count;
				audioData.close();
			}

			decoder.audioDataQueue.length = 0;

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
	// if (dbPeak > 0.98) console.log('clip');

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
	if (!source.audioConfig || !source.sampleSink || !source.info) return;
	if (source.info.type !== 'audio' && source.info.type !== 'video') return;
	// We are going to store 300 values per second to draw waveform
	// Step is how many samples we need per value
	const step = source.audioConfig.sampleRate / 300;
	const data = new Float32Array(source.info.duration * 300);

	const state = {
		currentIndex: 0,
		samplesRemaining: 0,
		previousMax: 0,
		tempSamples: []
	};

	for await (const sample of source.sampleSink.samples()) {
		const numberOfAudioDataSamples = sample.numberOfFrames;
		const rawData = new Float32Array(numberOfAudioDataSamples);
		sample.copyTo(rawData, {
			format: 'f32-planar',
			planeIndex: 0,
			frameOffset: 0
		});
		processAudioChunk(rawData, step, state, data);
		sample.close();
	}
	source.audioWaveform = data;
	timelineState.invalidateWaveform = true;
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

	for (const clip of timelineState.clips) {
		if (
			clip.deleted ||
			clip.start + clip.duration < startFrame ||
			clip.start > endFrame ||
			(clip.source.type !== 'video' && clip.source.type !== 'audio' && clip.source.type !== 'test')
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

		const bufferSampleRate = clip.source.audioConfig
			? clip.source.audioConfig.sampleRate
			: sampleRate;
		const audioBuffer = offlineAudioContext.createBuffer(
			2,
			durationSeconds * bufferSampleRate,
			bufferSampleRate
		);

		if (clip.source.type === 'test') {
			const duration = 2 / 30;
			const f32 = generateTone(true, sampleRate, sampleRate * duration);
			const f32Low = generateTone(false, sampleRate, sampleRate * duration);
			const channelDataLeft = audioBuffer.getChannelData(0);
			const channelDataRight = audioBuffer.getChannelData(1);
			for (let i = 0; i < Math.ceil(durationSeconds); i++) {
				const offset = sampleRate / 2 + i * sampleRate;
				if (offset + f32.length > channelDataLeft.length) break;
				channelDataLeft.set(i % 4 === 0 ? f32 : f32Low, offset);
				channelDataRight.set(i % 4 === 0 ? f32 : f32Low, offset);
			}
		} else {
			await decodeSource(audioBuffer, clip, sourceStartFrame);
		}

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
	if (!clip.source.sampleSink) return;
	let currentWriteOffset = 0;
	for await (const sample of clip.source.sampleSink.samples(startFrame / 30)) {
		for (let c = 0; c < sample.numberOfChannels; c++) {
			const finalBufferChannelData = audioBuffer.getChannelData(c);

			const destinationSlice = finalBufferChannelData.subarray(
				currentWriteOffset,
				currentWriteOffset + sample.numberOfFrames
			);

			sample.copyTo(destinationSlice, {
				format: 'f32-planar',
				planeIndex: c,
				frameCount: sample.numberOfFrames
			});
		}
		currentWriteOffset += sample.numberOfFrames;
		const numberOfFrames = sample.numberOfFrames;
		sample.close();

		if (currentWriteOffset + numberOfFrames >= audioBuffer.length) {
			// buffer full
			break;
		}
	}
};

const generateTone = (high = false, sampleRate: number, frameCount: number) => {
	const frequency = high ? 880 : 440; // A4 in Hz
	const fadeDuration = 0.0005;
	const fadeFrames = sampleRate * fadeDuration;
	const amplitude = 1;
	const f32 = new Float32Array(frameCount);
	for (let i = 0; i < frameCount; i++) {
		const time = i / sampleRate;
		let gain = 1;
		if (i > frameCount - fadeFrames) {
			gain = (frameCount - i) / fadeFrames;
		}
		f32[i] = gain * amplitude * Math.sin(2 * Math.PI * frequency * time);
	}
	return f32;
};
