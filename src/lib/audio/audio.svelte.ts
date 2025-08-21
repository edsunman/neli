//import type { ADecoder } from './decoder';
import { DecoderPool } from './pool';

export class AudioState {
	audioContext = new AudioContext();

	analyserNodeLeft: AnalyserNode;
	analyserNodeRight: AnalyserNode;
	splitterNode: ChannelSplitterNode;
	masterGainNode: GainNode;

	dummyF32Array = new Float32Array(1024);
	playingClips: string[] = [];
	gainNodes = new Map<string, GainNode | null>();
	panNodes = new Map<string, StereoPannerNode | null>();
	offsets = new Map<string, number>();
	decoderPool = new DecoderPool();

	startingFrame = 0;
	startingTime = 0;

	masterGain = $state(1);

	constructor() {
		this.analyserNodeLeft = this.audioContext.createAnalyser();
		this.analyserNodeLeft.fftSize = 1024;
		this.analyserNodeRight = this.audioContext.createAnalyser();
		this.analyserNodeRight.fftSize = 1024;
		//this.#analyserNode.smoothingTimeConstant = 1;

		this.splitterNode = this.audioContext.createChannelSplitter();
		this.splitterNode.connect(this.analyserNodeLeft, 0);
		this.splitterNode.connect(this.analyserNodeRight, 1);

		this.masterGainNode = this.audioContext.createGain();
		this.masterGainNode.connect(this.audioContext.destination);
		this.masterGainNode.connect(this.splitterNode);
	}
}
