import { Decoder } from './decoder';

const DEBUG = false;

export class DecoderPool {
	#pool: Decoder[] = [];
	#activeDecoders = new Set<Decoder>();
	#maxDecoders = 3;

	constructor() {
		this.#pool = [];
		this.#activeDecoders = new Set();
	}

	async getDecoder(config: VideoDecoderConfig) {
		let decoder;

		if (this.#activeDecoders.size < this.#maxDecoders) {
			if (this.#pool.length > 0) {
				decoder = this.#pool.shift();

				if (!decoder) return;
				if (DEBUG) console.log(`[DecoderPool] Reconfiguring any existing decoder from pool.`);
			} else {
				// No idle decoder, create a new one

				// TODO: too late to check this, should check on import
				const support = await VideoDecoder.isConfigSupported(config);
				if (!support.supported) {
					throw new Error(`[DecoderPool] Codec not supported by this browser.`);
				}

				decoder = new Decoder();

				if (DEBUG) console.log(`[DecoderPool] Created new decoder for ${config.codec}.`);
			}
		} else {
			// use the oldest active decoder
			let smallest = Infinity;
			let oldestDecoder;
			for (const d of this.#activeDecoders) {
				if (d.lastUsedTime < smallest) {
					smallest = d.lastUsedTime;
					oldestDecoder = d;
				}
			}

			decoder = oldestDecoder;
		}

		if (!decoder) return;

		decoder.lastUsedTime = performance.now();
		this.#activeDecoders.add(decoder);
		if (DEBUG)
			console.log(
				`[DecoderPool] Active decoders count: ${this.#activeDecoders.size}/${this.#maxDecoders}`
			);
		return decoder;
	}

	pauseAll() {
		for (const decoder of this.#activeDecoders) {
			if (decoder.running) {
				decoder.pause();
			}
		}
	}

	// TODO:
	//releaseIdleDecoders() {}
}
