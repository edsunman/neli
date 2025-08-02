import type { ADecoder } from './decoder';
import { DecoderPool } from './pool';

export class AudioState {
	audioContext;

	analyserNodeLeft: AnalyserNode;
	analyserNodeRight: AnalyserNode;
	splitterNode: ChannelSplitterNode;

	dummyF32Array = new Float32Array(1024);
	playingClips: string[] = [];
	gainNodes = new Map<string, GainNode | null>();
	offsets = new Map<string, number>();
	decoders = new Map<string, ADecoder>();
	decoderPool = new DecoderPool();

	startingFrame = 0;
	startingTime = 0;

	constructor() {
		this.audioContext = new AudioContext();

		this.analyserNodeLeft = this.audioContext.createAnalyser();
		this.analyserNodeLeft.fftSize = 1024;
		this.analyserNodeRight = this.audioContext.createAnalyser();
		this.analyserNodeRight.fftSize = 1024;
		//this.#analyserNode.smoothingTimeConstant = 1;

		this.splitterNode = this.audioContext.createChannelSplitter();
		this.splitterNode.connect(this.analyserNodeLeft, 0);
		this.splitterNode.connect(this.analyserNodeRight, 1);
	}
}
