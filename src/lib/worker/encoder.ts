import {
	Output,
	Mp4OutputFormat,
	StreamTarget,
	VideoSampleSource,
	VideoSample,
	AudioSampleSource,
	AudioSample,
	type StreamTargetChunk
} from 'mediabunny';

/**
 * Responsible for encoding VideoFrames and creating Mp4 file
 */
export class Encoder {
	private output: Output<Mp4OutputFormat, StreamTarget> | null = null;
	private frameCounter = 0;
	private handle: FileSystemFileHandle | undefined;
	private syncHandle: FileSystemSyncAccessHandle | undefined;
	private videoSampleSource: VideoSampleSource | undefined;
	private audioSampleSource: AudioSampleSource | undefined;

	async setup() {
		this.audioSampleSource = new AudioSampleSource({
			codec: 'aac',
			bitrate: 128_000
		});

		this.videoSampleSource = new VideoSampleSource({
			codec: 'avc',
			bitrate: 10_000_000,
			keyFrameInterval: 1
		});

		const root = await navigator.storage.getDirectory();
		this.handle = await root.getFileHandle('temp_video.mp4', { create: true });
		this.syncHandle = await this.handle.createSyncAccessHandle();
		const syncHandle = this.syncHandle;

		const writableStream = new WritableStream({
			write(chunk: StreamTargetChunk) {
				syncHandle.write(chunk.data, { at: chunk.position });
			}
		});

		this.output = new Output({
			format: new Mp4OutputFormat({
				fastStart: false
			}),
			target: new StreamTarget(writableStream, { chunked: true, chunkSize: 4_000_000 })
		});
		this.output.addVideoTrack(this.videoSampleSource, {
			rotation: 0,
			frameRate: 30
		});
		this.output.addAudioTrack(this.audioSampleSource);

		await this.output.start();
	}

	async encode(frame: VideoFrame) {
		if (!this.videoSampleSource) return;
		const sample = new VideoSample(frame);
		await this.videoSampleSource.add(sample);
		sample.close();
		this.frameCounter++;
	}

	async encodeAudio(audioData: AudioData) {
		if (!this.audioSampleSource) return;
		const sample = new AudioSample(audioData);
		await this.audioSampleSource.add(sample);
		sample.close();
	}

	async finalize() {
		if (!this.output || !this.handle || !this.syncHandle) return;

		await this.output.finalize();
		this.syncHandle.flush();
		this.syncHandle.close();
		return await this.handle.getFile();
	}

	async cancel() {
		if (!this.output || !this.syncHandle) return;
		await this.output.cancel();
		this.syncHandle.flush();
		this.syncHandle.close();
	}
}
