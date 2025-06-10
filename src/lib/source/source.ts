export class Source {
	id: string;
	url: string;
	duration: number;

	constructor(url: string) {
		this.id = Math.random().toString(16).slice(2);
		this.url = url;
		this.duration = 0;
	}
}
