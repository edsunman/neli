import { Decoder } from './decoder';

type DecoderInfo = {
	decoder: Decoder;
	lastConfig: VideoDecoderConfig;
	lastUsedTime: number;
};

export class DecoderPool {
	pool = [];
	activeDecoders = new Set<DecoderInfo>();
	maxDecoders;

	constructor(maxDecoders = 3) {
		// Pool stores objects like: { decoder: VideoDecoder, lastConfig: VideoDecoderConfig, codecString: string, lastUsedTime: number }
		// This will now be a single array of idle decoderInfo objects, not mapped by codec.
		this.pool = [];

		// Tracks currently active decoderInfo objects.
		this.activeDecoders = new Set();

		this.maxDecoders = maxDecoders;
	}

	/**
	 * Acquires a VideoDecoder instance from the pool or creates a new one.
	 * Grabs any available idle decoder and reconfigures it, or creates a new one if space allows.
	 *
	 */
	async getDecoder(config: VideoDecoderConfig) {
		//const requestedCodecString = codecConfig.codec;
		let decoderInfo; // Will hold the { decoder, lastConfig, codecString, lastUsedTime } object

		// 1. Check if we have space for a new active decoder (either from pool or new creation)
		if (this.activeDecoders.size < this.maxDecoders) {
			// 2. Try to grab any idle decoder from the pool first
			if (this.pool.length > 0) {
				// Found an idle decoder. Grab it regardless of its previous config/codec.
				decoderInfo = this.pool.shift(); // Take the first available idle decoder
				const existingDecoder = decoderInfo!.decoder;

				console.log(`[DecoderPool] Reconfiguring any existing decoder from pool.`);
				// Always reset and re-configure when reusing, for a clean slate and new config.
				await existingDecoder.reset();
				await existingDecoder.configure(config);

				// Update the stored config and codec string to the new configuration
				//decoderInfo.lastConfig = codecConfig;
				//decoderInfo.codecString = requestedCodecString;
			} else {
				// 3. No idle decoder, create a new one as we have space
				// Verify codec support before creating a new decoder instance
				const support = await VideoDecoder.isConfigSupported(config);
				if (!support.supported) {
					throw new Error(`[DecoderPool] Codec not supported by this browser.`);
				}

				const newDecoder = new Decoder();
				//newDecoder.setupDecoder(config, chunks);

				decoderInfo = {
					decoder: newDecoder,
					lastConfig: config,
					//codecString: config., // Initial codec string for this new decoder
					lastUsedTime: performance.now()
				};
				console.log(`[DecoderPool] Created new decoder for ${config.codec}.`);
			}
		} else {
			console.warn(
				`[DecoderPool] Decoder pool full (${this.activeDecoders.size}/${this.maxDecoders}). Cannot acquire a new decoder. Consider increasing maxDecoders or optimizing usage.`
			);
			return null; // Signal that no decoder could be acquired
		}

		if (!decoderInfo) return;

		decoderInfo.lastUsedTime = performance.now(); // Update last used time
		this.activeDecoders.add(decoderInfo); // Add the full info object to the active set
		console.log(
			`[DecoderPool] Active decoders count: ${this.activeDecoders.size}/${this.maxDecoders}`
		);
		return decoderInfo.decoder; // Return the actual decoder instance to the caller
	}

	pauseAll() {
		for (const info of this.activeDecoders) {
			if (info.decoder.running) {
				info.decoder.pause();
				console.log('paused', info.lastConfig.codec);
			}
		}
	}

	/**
	 * Releases a VideoDecoder instance back to the pool.
	 * The decoder is marked as idle and its lastUsedTime is updated.
	 * @param {VideoDecoder} decoder - The VideoDecoder instance to release.
	 */
	releaseDecoder(decoder) {
		// Find the corresponding decoderInfo object in the active set
		let decoderInfoToRelease = null;
		for (const info of this.activeDecoders) {
			if (info.decoder === decoder) {
				decoderInfoToRelease = info;
				break;
			}
		}

		if (decoderInfoToRelease) {
			this.activeDecoders.delete(decoderInfoToRelease);
			// Add the info object back to the general pool (array)
			this.pool.push(decoderInfoToRelease);
			decoderInfoToRelease.lastUsedTime = performance.now(); // Update last used time on release
			console.log(
				`[DecoderPool] Released decoder. Active decoders: ${this.activeDecoders.size}/${this.maxDecoders}`
			);
		} else {
			console.warn(
				'[DecoderPool] Attempted to release a decoder not found in the active set. It might have already been closed or released.'
			);
		}
	}

	/**
	 * This helper function is no longer directly used in getDecoder with the simplified logic,
	 * as all retrieved decoders are now always reconfigured.
	 * It remains as a utility if needed elsewhere or for future expansions.
	 * @param {VideoDecoderConfig} config1
	 * @param {VideoDecoderConfig} config2
	 * @returns {boolean} True if the configurations are considered equal for reuse purposes.
	 * @private
	 */
	_areConfigsEqual(config1, config2) {
		// If either config is null/undefined, they are not equal
		if (!config1 || !config2) return false;

		// Codec string MUST be identical for reconfiguration, otherwise a new decoder is needed.
		if (config1.codec !== config2.codec) return false;

		// Compare other essential parameters. Add more if your application relies on them for unique configs.
		// For example, colorSpace, hardwareAcceleration, optimizeForLatency etc.
		return config1.codedWidth === config2.codedWidth && config1.codedHeight === config2.codedHeight;
	}

	/**
	 * Periodically cleans up idle decoders from the pool that haven't been used for a while.
	 * This helps free up system resources.
	 * Call this from your main worker loop or a separate timer.
	 * @param {number} idleTimeoutMs - Time in milliseconds after which an idle decoder is closed.
	 */
	async cleanupIdleDecoders(idleTimeoutMs = 30 * 1000) {
		// Default: close after 30 seconds idle
		const now = performance.now();
		const stillIdle = [];

		for (const info of this.pool) {
			// Iterate through the single pool array
			if (info.lastUsedTime && now - info.lastUsedTime > idleTimeoutMs) {
				await info.decoder.close();
				console.log(`[DecoderPool] Closed idle decoder for ${info.codecString} (timed out).`);
			} else {
				stillIdle.push(info); // Keep decoders that are still "fresh"
			}
		}
		this.pool = stillIdle; // Update the pool to only contain non-timed-out decoders
	}

	/**
	 * Closes all active and pooled decoder instances, releasing all associated resources.
	 * Call this when your video editor session is ending.
	 */
	async closeAll() {
		console.log('[DecoderPool] Closing all decoders...');
		// Close all active decoders
		for (const info of this.activeDecoders) {
			await info.decoder.close();
		}
		this.activeDecoders.clear();

		// Close all idle decoders in the pool
		for (const info of this.pool) {
			// Iterate through the single pool array
			await info.decoder.close();
		}
		this.pool = []; // Clear the pool array
		console.log('[DecoderPool] All decoders closed.');
	}
}
