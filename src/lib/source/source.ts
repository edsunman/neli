import type { Movie } from 'mp4box';

export class Source {
	id: string;
	name: string;
	duration: number;
	file: File;

	constructor(info: Movie, file: File) {
		/*       let videoTrack = info.; 
        info.tracks.forEach((track)=>{
            if (track.type === 'video'){
                videoTrack = track
            }
        }) */
		/*  videoTrack */
		this.id = Math.random().toString(16).slice(2);
		this.name = file.name;
		this.file = file;
		this.duration = info.videoTracks[0].nb_samples;
		console.log(this);
	}
}
