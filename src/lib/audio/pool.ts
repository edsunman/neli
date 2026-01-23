import { ADecoder } from './decoder';

const DEBUG = false;

export class DecoderPool {
	decoders = new Map<string, ADecoder>();

	private maxDecoders = 6;
	private decoderCount = 0;

	assignDecoder(clipId: string) {
		let decoder = this.decoders.get(clipId);
		if (!decoder) {
			if (this.decoders.size < this.maxDecoders) {
				// Create a new decoder
				decoder = new ADecoder();
				this.decoderCount++;
				decoder.id = this.decoderCount;
				if (DEBUG) console.log(`[Pool] Created new decoder. Pool size:${this.decoders.size}`);
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
		}

		if (!decoder) return;

		decoder.lastUsedTime = performance.now();
		decoder.pause();
		this.decoders.set(clipId, decoder);

		if (DEBUG) console.log(`[Pool] Decoders in pool: ${this.decoders.size}/${this.maxDecoders}`);
		return decoder;
	}

	playDecoder(clipId: string, frame: number, frameRate = 30) {
		const frameDurationMs = 1000 / frameRate;
		const frameTimeMs = frame * frameDurationMs;
		this.decoders.get(clipId)?.play(frameTimeMs);
	}

	runDecoder(clipId: string, elapsedTimeMs: number, encoding = false) {
		this.decoders.get(clipId)?.run(elapsedTimeMs, encoding);
	}

	pauseDecoder(clipId: string) {
		this.decoders.get(clipId)?.pause();
	}

	pauseAll() {
		for (const [, decoder] of this.decoders) {
			if (decoder.running) {
				decoder.pause();
				if (DEBUG) console.log(`[Pool] Paused ${decoder.id}`);
			}
		}
	}
}
