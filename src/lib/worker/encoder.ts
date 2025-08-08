import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Responsible for encoding VideoFrames and creating Mp4 file
 */
export class Encoder {
	#muxer: Muxer<ArrayBufferTarget> | null = null;
	#encoder: VideoEncoder | null = null;
	#audioEncoder: AudioEncoder | null = null;
	#frameCounter = 0;

	async setup() {
		this.#encoder = new VideoEncoder({
			output: (chunk, meta) => this.#muxer?.addVideoChunk(chunk, meta),
			error: (e) => console.error(e)
		});

		this.#audioEncoder = new AudioEncoder({
			output: (chunk, meta) => {
				this.#muxer?.addAudioChunk(chunk, meta);
			},
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

		this.#muxer = new Muxer({
			target: new ArrayBufferTarget(),
			audio: {
				codec: 'aac',
				numberOfChannels: 2,
				sampleRate: 48000
			},
			video: {
				codec: 'avc',
				width: 1920,
				height: 1080
			},
			fastStart: 'in-memory'
		});
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
		if (!this.#muxer || !this.#encoder || !this.#audioEncoder) return;

		await this.#encoder.flush();

		this.#encoder.close();
		this.#encoder = null;

		this.#muxer.finalize();

		const buffer = this.#muxer.target.buffer;
		console.log(new Blob([buffer]));
		const blob = new Blob([buffer]);

		// clear buffer
		this.#muxer = null;

		// TODO: there must be a better way to do this
		// transfer buffer to main thread?
		return URL.createObjectURL(blob);
	}
}
