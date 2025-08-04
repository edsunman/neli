import { getClip, setClipJoins } from '$lib/clip/actions';
import type { Clip } from '$lib/clip/clip.svelte';
import { timelineState } from '$lib/state.svelte';
import { updateWorkerClip } from '$lib/worker/actions';

type Command =
	| { action: 'addClip'; data: { clipId: string } }
	| { action: 'deleteClip'; data: { clipId: string } }
	| {
			action: 'moveClip';
			data: { clipId: string; oldStart: number; newStart: number; track: number };
	  }
	| {
			action: 'trimClip';
			data: {
				clipId: string;
				oldStart: number;
				newStart: number;
				oldDuration: number;
				newDuration: number;
			};
	  };

export class HistoryManager {
	#debug = true;
	#undoStack: Command[][] = [];
	#redoStack: Command[][] = [];
	#tempCommand: Command[] = [];

	newCommand(command: Command) {
		this.#redoStack = [];
		this.#undoStack.unshift([command]);
		if (this.#debug) console.debug('new command ', command);
	}

	pushAction(command: Command) {
		this.#tempCommand.push(command);
		if (this.#debug) console.debug('new action ', command);
	}

	finishCommand() {
		if (this.#tempCommand.length < 1) return;
		const newCommand = structuredClone(this.#tempCommand);
		this.#undoStack.unshift(newCommand);
		this.#tempCommand = [];
		if (this.#debug) console.debug('new command ', newCommand);
	}

	undo() {
		const commands = this.#undoStack.splice(0, 1)[0];
		if (!commands) {
			if (this.#debug) console.debug('nothing to undo');
			return;
		}

		this.#redoStack.unshift(commands);
		if (this.#debug) console.debug('added to redo stack ', commands);

		const updatedClips = new Set<Clip>();
		for (const command of commands) {
			switch (command.action) {
				case 'addClip':
					for (const clip of timelineState.clips) {
						if (clip.id === command.data.clipId) {
							clip.deleted = true;
							if (clip.id === timelineState.selectedClip?.id) {
								timelineState.selectedClip = null;
							}
							updatedClips.add(clip);
						}
					}
					break;
				case 'deleteClip':
					for (const clip of timelineState.clips) {
						if (clip.id === command.data.clipId) {
							clip.deleted = false;
							updatedClips.add(clip);
						}
					}
					break;
				case 'moveClip': {
					const clip = getClip(command.data.clipId);
					if (!clip) break;
					clip.start = command.data.oldStart;
					updatedClips.add(clip);
					break;
				}
				case 'trimClip': {
					const clip = getClip(command.data.clipId);
					if (!clip) break;
					clip.start = command.data.oldStart;
					clip.duration = command.data.oldDuration;
					updatedClips.add(clip);
					break;
				}
			}
		}

		for (const clip of updatedClips) {
			updateWorkerClip(clip);
			setClipJoins(clip);
		}
		timelineState.invalidate = true;
	}

	redo() {
		const commands = this.#redoStack.splice(0, 1)[0];
		if (!commands) {
			if (this.#debug) console.debug('nothing to redo');
			return;
		}
		this.#undoStack.unshift(commands);
		if (this.#debug) console.debug('added to undo stack ', commands);

		const updatedClips = new Set<Clip>();
		for (const command of commands) {
			switch (command.action) {
				case 'addClip':
					for (const clip of timelineState.clips) {
						if (clip.id === command.data.clipId) {
							clip.deleted = false;
							updatedClips.add(clip);
						}
					}
					break;
				case 'deleteClip':
					for (const clip of timelineState.clips) {
						if (clip.id === command.data.clipId) {
							clip.deleted = true;
							if (clip.id === timelineState.selectedClip?.id) {
								timelineState.selectedClip = null;
							}
							updatedClips.add(clip);
						}
					}
					break;
				case 'moveClip': {
					const clip = getClip(command.data.clipId);
					if (!clip) break;
					clip.start = command.data.newStart;
					updatedClips.add(clip);
					break;
				}
				case 'trimClip': {
					const clip = getClip(command.data.clipId);
					if (!clip) break;
					clip.start = command.data.newStart;
					clip.duration = command.data.newDuration;
					updatedClips.add(clip);
					break;
				}
			}
		}

		for (const clip of updatedClips) {
			updateWorkerClip(clip);
			setClipJoins(clip);
		}
		timelineState.invalidate = true;
	}
}
