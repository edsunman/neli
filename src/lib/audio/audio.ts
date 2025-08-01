export class AudioState {
	audioContext;

	//gainNode: GainNode | null = null;
	analyserNodeLeft: AnalyserNode;
	analyserNodeRight: AnalyserNode;
	splitterNode: ChannelSplitterNode;

	//currentOffset = 0;
	dummyF32Array = new Float32Array(1024);
	playingClips: string[] = [];
	gainNodes = new Map<string, GainNode | null>();
	offsets = new Map<string, number>();

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

		//this.gainNode = this.audioContext.createGain();
		//this.gainNode.connect(this.splitterNode);
		//this.gainNode.connect(this.audioContext.destination);
	}
}
