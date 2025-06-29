import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Responsible for encoding VideoFrames and creating Mp4 file
 */
export class Encoder {
	#muxer: Muxer<ArrayBufferTarget> | null = null;
	#encoder: VideoEncoder | null = null;
	#frameCounter = 0;

	setup() {
		this.#encoder = new VideoEncoder({
			output: (chunk, meta) => this.#muxer?.addVideoChunk(chunk, meta),
			error: (e) => console.error(e)
		});

		this.#encoder.configure({
			codec: 'avc1.420029',
			width: 1920,
			height: 1080,
			bitrate: 10_000_000,
			bitrateMode: 'constant'
		});
		this.#muxer = new Muxer({
			target: new ArrayBufferTarget(),
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

	async finalize() {
		if (!this.#muxer || !this.#encoder) return;

		await this.#encoder.flush();
		this.#encoder.close();
		this.#encoder = null;

		this.#muxer.finalize();

		const buffer = this.#muxer.target.buffer;
		console.log(new Blob([buffer]));
		const blob = new Blob([buffer]);

		// clear buffer
		this.#muxer = null;

		return URL.createObjectURL(blob);
	}
}
