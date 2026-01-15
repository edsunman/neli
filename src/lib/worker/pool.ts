import { VDecoder } from './decoder';

const DEBUG = true;

export class DecoderPool {
	decoders = new Map<string, VDecoder>();
	#maxDecoders = 4;
	#decoderCount = 0;

	assignDecoder(clipId: string) {
		let decoder;
		if (this.decoders.size < this.#maxDecoders) {
			// No idle decoder, create a new one
			decoder = new VDecoder();
			this.#decoderCount++;
			decoder.id = this.#decoderCount;
			if (DEBUG) console.log(`[Pool] Created new decoder`);
		} else {
			// Use the oldest active decoder
			let smallest = Infinity;
			let oldestDecoder;
			let oldestDecoderKey;
			for (const [key, d] of this.decoders) {
				if (d.lastUsedTime < smallest) {
					smallest = d.lastUsedTime;
					oldestDecoder = d;
					oldestDecoderKey = key;
				}
			}
			if (oldestDecoderKey) this.decoders.delete(oldestDecoderKey);
			decoder = oldestDecoder;
			if (DEBUG) console.log(`[Pool] Using decoder ${decoder!.id}`);
		}

		if (!decoder) return;

		decoder.lastUsedTime = performance.now();
		decoder.pause();
		this.decoders.set(clipId, decoder);

		if (DEBUG) console.log(`[Pool] Active decoders: ${this.decoders.size}/${this.#maxDecoders}`);
		return decoder;
	}

	async pauseAll() {
		for (const [, decoder] of this.decoders) {
			if (decoder.running) {
				if (DEBUG) console.log(`[Pool] Decoder ${decoder.id} paused `);
				await decoder.pause();
			}
		}
	}

	markAllAsUnused() {
		for (const [, decoder] of this.decoders) {
			decoder.usedThisFrame = false;
		}
	}

	pauseAllUnused() {
		for (const [, decoder] of this.decoders) {
			if (!decoder.usedThisFrame) {
				decoder.pause();
			}
		}
	}
}
