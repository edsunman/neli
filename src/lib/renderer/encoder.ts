import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
/**
 * Responsible for encoding VideoFrames and creating Mp4 file
 */
export class Encoder {
	#muxer;
	#encoder;

	constructor() {
		this.#muxer = new Muxer({
			target: new ArrayBufferTarget(),
			video: {
				codec: 'avc',
				width: 1920,
				height: 1080
			},
			fastStart: 'in-memory'
		});

		this.#encoder = new VideoEncoder({
			output: (chunk, meta) => this.#muxer.addVideoChunk(chunk, meta),
			error: (e) => console.error(e)
		});

		this.#encoder.configure({
			codec: 'avc1.420029',
			width: 1920,
			height: 1080,
			bitrate: 10_000_000,
			bitrateMode: 'constant'
		});
	}

	encode(frame: VideoFrame) {
		this.#encoder.encode(frame);
	}

	async finalize() {
		await this.#encoder.flush();

		this.#muxer.finalize();

		const buffer = this.#muxer.target.buffer;
		console.log(new Blob([buffer]));
		const blob = new Blob([buffer]);
		return URL.createObjectURL(blob);
	}
}
