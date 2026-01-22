import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny';

self.addEventListener('message', async function (event) {
	switch (event.data.command) {
		case 'load-file':
			{
				if (!event.data.file) return;

				const input = new Input({
					formats: ALL_FORMATS,
					source: new BlobSource(event.data.file)
				});

				const audioTrack = await input.getPrimaryAudioTrack();
				const audioConfig = await audioTrack?.getDecoderConfig();

				if (!audioTrack || !audioConfig) return;

				const duration = await audioTrack.computeDuration();
				const sampleSink = new AudioSampleSink(audioTrack);

				generateWaveformData(sampleSink, audioConfig, duration, event.data.sourceId);
			}
			break;
	}
});

export const generateWaveformData = async (
	sampleSink: AudioSampleSink,
	audioConfig: AudioDecoderConfig,
	duration: number,
	sourceId: string
) => {
	// We are going to store 300 values per second to draw waveform
	// Step is how many samples we need per value
	const step = audioConfig.sampleRate / 300;
	const data = new Float32Array(duration * 300);

	const state = {
		currentIndex: 0,
		samplesRemaining: 0,
		previousMax: 0,
		tempSamples: []
	};

	for await (const sample of sampleSink.samples(0, 300)) {
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

	self.postMessage({ command: 'waveform-complete', sourceId, data }, [data.buffer]);
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
