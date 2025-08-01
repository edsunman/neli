import { VDecoder } from './decoder';

const DEBUG = false;

export class DecoderPool {
	#activeDecoders = new Set<VDecoder>();
	#maxDecoders = 3;
	#decoderCount = 0;

	constructor() {
		this.#activeDecoders = new Set();
	}

	async getDecoder() {
		let decoder;
		if (this.#activeDecoders.size < this.#maxDecoders) {
			// No idle decoder, create a new one
			decoder = new VDecoder();
			this.#decoderCount++;
			decoder.id = this.#decoderCount;
			if (DEBUG) console.log(`[Pool] Created new decoder`);
		} else {
			// Use the oldest active decoder
			let smallest = Infinity;
			let oldestDecoder;
			for (const d of this.#activeDecoders) {
				if (d.lastUsedTime < smallest) {
					smallest = d.lastUsedTime;
					oldestDecoder = d;
				}
			}
			decoder = oldestDecoder;
			if (DEBUG) console.log(`[Pool] Using decoder ${decoder!.id}`);
		}

		if (!decoder) return;

		decoder.lastUsedTime = performance.now();
		decoder.pause();
		this.#activeDecoders.add(decoder);

		if (DEBUG)
			console.log(`[Pool] Active decoders: ${this.#activeDecoders.size}/${this.#maxDecoders}`);
		return decoder;
	}

	pauseAll() {
		for (const decoder of this.#activeDecoders) {
			if (decoder.running) {
				decoder.pause();
			}
		}
	}

	markAllAsUnused() {
		for (const decoder of this.#activeDecoders) {
			decoder.usedThisFrame = false;
		}
	}

	pauseAllUnused() {
		for (const decoder of this.#activeDecoders) {
			if (!decoder.usedThisFrame) decoder.pause();
		}
	}
}
