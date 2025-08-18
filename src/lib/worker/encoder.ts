import {
	Output,
	Mp4OutputFormat,
	BufferTarget,
	EncodedVideoPacketSource,
	EncodedAudioPacketSource,
	EncodedPacket
} from 'mediabunny';

/**
 * Responsible for encoding VideoFrames and creating Mp4 file
 */
export class Encoder {
	#output: Output<Mp4OutputFormat, BufferTarget> | null = null;
	#encoder: VideoEncoder | null = null;
	#audioEncoder: AudioEncoder | null = null;
	#frameCounter = 0;

	async setup() {
		this.#encoder = new VideoEncoder({
			output: async (chunk, meta) =>
				await videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta),
			error: (e) => console.error(e)
		});

		this.#audioEncoder = new AudioEncoder({
			output: async (chunk, meta) =>
				await audioSource.add(EncodedPacket.fromEncodedChunk(chunk), meta),
			error: (e) => console.error(e)
		});

		this.#encoder.configure({
			codec: 'avc1.420029',
			width: 1920,
			height: 1080,
			bitrate: 10_000_000,
			bitrateMode: 'constant'
		});
		const encoderConfig = {
			codec: 'mp4a.40.2',
			numberOfChannels: 2,
			sampleRate: 48000,
			bitrate: 128000
		};
		this.#audioEncoder.configure(encoderConfig);

		this.#output = new Output({
			format: new Mp4OutputFormat({
				fastStart: 'in-memory'
				//minimumFragmentDuration: MIN_FRAGMENT_DURATION
			}),
			target: new BufferTarget()
		});

		const videoSource = new EncodedVideoPacketSource('avc');
		this.#output.addVideoTrack(videoSource, {
			rotation: 0,
			frameRate: 30
		});

		const audioSource = new EncodedAudioPacketSource('aac');
		this.#output.addAudioTrack(audioSource);

		await this.#output.start();
	}

	encode(frame: VideoFrame) {
		if (!this.#encoder) return;
		let keyFrame = false;
		if (this.#frameCounter % 30 === 0) {
			keyFrame = true;
		}
		this.#encoder.encode(frame, { keyFrame });
		this.#frameCounter++;
	}

	encodeAudio(audioData: AudioData) {
		if (!this.#audioEncoder) return;
		this.#audioEncoder.encode(audioData);
		audioData.close();
	}

	async finalizeAudio() {
		if (!this.#audioEncoder) return;
		await this.#audioEncoder.flush();
	}

	async finalize() {
		if (!this.#output || !this.#encoder || !this.#audioEncoder) return;

		await this.#encoder.flush();

		this.#encoder.close();
		this.#encoder = null;

		await this.#output.finalize();

		const buffer = this.#output.target.buffer;

		if (!buffer) return;
		console.log(new Blob([buffer]));
		const blob = new Blob([buffer]);

		// clear buffer
		this.#output = null;

		// TODO: there must be a better way to do this
		// transfer buffer to main thread?
		return URL.createObjectURL(blob);
	}
}
