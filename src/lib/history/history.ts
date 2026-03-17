import { getClip, setAllJoins } from '$lib/clip/actions';
import type { Clip } from '$lib/clip/clip.svelte';
import { assignSourcesToFolders, getSourceFromId } from '$lib/source/actions';
import { projectManager, timelineState, workerManager } from '$lib/state.svelte';
import { setAllTrackTypes, setTrackPositions } from '$lib/timeline/actions';
import type { Command, TrackType } from '$lib/types';

export class HistoryManager {
	private debug = false;
	private undoStack: ICommand[][] = [];
	private redoStack: ICommand[][] = [];
	private tempCommand: ICommand[] = [];

	newCommand(command: Command) {
		this.redoStack = [];
		this.undoStack.unshift([this.toCommandObject(command)]);
		if (this.debug) console.debug('new command ', command);
	}

	pushAction(command: Command) {
		this.tempCommand.push(this.toCommandObject(command));
		if (this.debug) console.debug('new action ', command);
	}

	finishCommand() {
		if (this.tempCommand.length < 1) return;
		this.redoStack = [];
		const newCommand = [...this.tempCommand];
		this.undoStack.unshift(newCommand);
		this.tempCommand = [];
		if (this.debug) console.debug('new command ', newCommand);
	}

	undo() {
		const commands = this.undoStack.shift();
		if (!commands) {
			if (this.debug) console.debug('nothing to undo');
			return;
		}

		this.redoStack.unshift(commands);
		if (this.debug) console.debug('added to redo stack ', commands);

		const updatedClips = new Set<Clip>();
		const reversed = [...commands].reverse();
		for (const command of reversed) {
			command.undo(updatedClips);
		}

		workerManager.sendClip(Array.from(updatedClips));
		projectManager.updateClip(Array.from(updatedClips));
		setAllJoins();
		setAllTrackTypes();
		timelineState.invalidateWaveform = true;
	}

	redo() {
		const commands = this.redoStack.shift();
		if (!commands) {
			if (this.debug) console.debug('nothing to redo');
			return;
		}
		this.undoStack.unshift(commands);
		if (this.debug) console.debug('added to undo stack ', commands);

		const updatedClips = new Set<Clip>();
		for (const command of commands) {
			command.redo(updatedClips);
		}

		workerManager.sendClip(Array.from(updatedClips));
		projectManager.updateClip(Array.from(updatedClips));
		setAllJoins();
		setAllTrackTypes();
		timelineState.invalidateWaveform = true;
	}

	reset() {
		this.undoStack.length = 0;
		this.redoStack.length = 0;
		this.tempCommand.length = 0;
	}

	private toCommandObject(command: Command): ICommand {
		switch (command.action) {
			case 'addClip':
				return new AddClipCommand(command.data.clipId);
			case 'deleteClip':
				return new DeleteClipCommand(command.data.clipId);
			case 'moveClip':
				return new MoveClipCommand(
					command.data.clipId,
					command.data.oldStart,
					command.data.newStart,
					command.data.oldTrack,
					command.data.newTrack
				);
			case 'trimClip':
				return new TrimClipCommand(
					command.data.clipId,
					command.data.oldStart,
					command.data.newStart,
					command.data.oldDuration,
					command.data.newDuration
				);
			case 'clipParam':
				return new ClipParamCommand(
					command.data.clipId,
					command.data.paramIndex,
					command.data.oldValue,
					command.data.newValue
				);
			case 'addTrack':
				return new AddTrackCommand(command.data.number, command.data.type);
			case 'removeTrack':
				return new RemoveTrackCommand(command.data.number, command.data.type);
			case 'deleteSource':
				return new DeleteSourceCommand(command.data.sourceId);
		}
	}
}

interface ICommand {
	redo(updatedClips: Set<Clip>): void;
	undo(updatedClips: Set<Clip>): void;
}

class AddClipCommand implements ICommand {
	constructor(private clipId: string) {}
	redo(updatedClips: Set<Clip>) {
		for (const clip of timelineState.clips) {
			if (clip.id === this.clipId) {
				clip.deleted = false;
				updatedClips.add(clip);
			}
		}
	}
	undo(updatedClips: Set<Clip>) {
		for (const clip of timelineState.clips) {
			if (clip.id === this.clipId) {
				clip.deleted = true;
				if (clip.id === timelineState.selectedClip?.id) {
					timelineState.selectedClip = null;
				}
				updatedClips.add(clip);
			}
		}
	}
}

class DeleteClipCommand implements ICommand {
	constructor(private clipId: string) {}
	redo(updatedClips: Set<Clip>) {
		for (const clip of timelineState.clips) {
			if (clip.id === this.clipId) {
				clip.deleted = true;
				if (clip.id === timelineState.selectedClip?.id) {
					timelineState.selectedClip = null;
				}
				updatedClips.add(clip);
			}
		}
	}
	undo(updatedClips: Set<Clip>) {
		for (const clip of timelineState.clips) {
			if (clip.id === this.clipId) {
				clip.deleted = false;
				updatedClips.add(clip);
			}
		}
	}
}

class DeleteSourceCommand implements ICommand {
	constructor(private sourceId: string) {}
	redo() {
		const source = getSourceFromId(this.sourceId);
		if (!source) return;
		source.deleted = true;
		projectManager.updateSource(source.id, { deleted: true });
		assignSourcesToFolders();
	}
	undo() {
		const source = getSourceFromId(this.sourceId);
		if (!source) return;
		source.deleted = false;
		projectManager.updateSource(source.id, { deleted: false });
		assignSourcesToFolders(source.id);
	}
}

class MoveClipCommand implements ICommand {
	constructor(
		private clipId: string,
		private oldStart: number,
		private newStart: number,
		private oldTrack: number,
		private newTrack: number
	) {}
	redo(updatedClips: Set<Clip>) {
		const clip = getClip(this.clipId);
		if (!clip) return;
		clip.start = this.newStart;
		clip.track = this.newTrack;
		updatedClips.add(clip);
	}
	undo(updatedClips: Set<Clip>) {
		const clip = getClip(this.clipId);
		if (!clip) return;
		clip.start = this.oldStart;
		clip.track = this.oldTrack;
		updatedClips.add(clip);
	}
}

class TrimClipCommand implements ICommand {
	constructor(
		private clipId: string,
		private oldStart: number,
		private newStart: number,
		private oldDuration: number,
		private newDuration: number
	) {}
	redo(updatedClips: Set<Clip>) {
		const clip = getClip(this.clipId);
		if (!clip) return;
		clip.start = this.newStart;
		clip.duration = this.newDuration;
		updatedClips.add(clip);
	}
	undo(updatedClips: Set<Clip>) {
		const clip = getClip(this.clipId);
		if (!clip) return;
		clip.start = this.oldStart;
		clip.duration = this.oldDuration;
		updatedClips.add(clip);
	}
}

class ClipParamCommand implements ICommand {
	constructor(
		private clipId: string,
		private paramIndex: number[],
		private oldValue: number[],
		private newValue: number[]
	) {}
	redo(updatedClips: Set<Clip>) {
		const clip = getClip(this.clipId);
		if (!clip) return;
		for (let i = 0; i < this.paramIndex.length; i++) {
			clip.params[this.paramIndex[i]] = this.newValue[i];
		}
		updatedClips.add(clip);
	}
	undo(updatedClips: Set<Clip>) {
		const clip = getClip(this.clipId);
		if (!clip) return;
		for (let i = 0; i < this.paramIndex.length; i++) {
			clip.params[this.paramIndex[i]] = this.oldValue[i];
		}
		updatedClips.add(clip);
	}
}

class AddTrackCommand implements ICommand {
	constructor(
		private number: number,
		private type: TrackType
	) {}
	redo() {
		timelineState.tracks.push({
			height: 35,
			top: 0,
			lock: true,
			lockBottom: true,
			lockTop: true,
			type: this.type
		});
		setTrackPositions();
	}
	undo() {
		timelineState.tracks.splice(this.number - 1, 1);
		setTrackPositions();
	}
}

class RemoveTrackCommand implements ICommand {
	constructor(
		private number: number,
		private type: TrackType
	) {}
	redo() {
		timelineState.tracks.splice(this.number - 1, 1);
		setTrackPositions();
	}
	undo() {
		timelineState.tracks.push({
			height: 35,
			top: 0,
			lock: true,
			lockBottom: true,
			lockTop: true,
			type: this.type
		});
		setTrackPositions();
	}
}
