import { deleteClip } from '$lib/clip/actions';
import { timelineState } from '$lib/state.svelte';

type Command =
	| { action: 'addClip'; data: { clipId: string } }
	| { action: 'deleteClip'; data: { clipId: string } };

export class HistoryManager {
	#log = false;
	#undoStack: Command[] = [];
	#redoStack: Command[] = [];

	newCommand(command: Command) {
		this.#redoStack = [];
		this.#undoStack.unshift(command);
		if (this.#log) console.log('new action ', command.action);
	}

	undo() {
		const command = this.#undoStack.splice(0, 1)[0];
		if (!command) {
			if (this.#log) console.log('nothing to undo');
			return;
		}

		this.#redoStack.unshift(command);
		if (this.#log) console.log('added to redo stack ', command.action);

		switch (command.action) {
			case 'addClip':
				deleteClip(command.data.clipId, false, true);
				timelineState.invalidate = true;
				break;
			case 'deleteClip':
				deleteClip(command.data.clipId, true, true);
				timelineState.invalidate = true;
				break;
		}
	}

	redo() {
		const command = this.#redoStack.splice(0, 1)[0];
		if (!command) {
			if (this.#log) console.log('nothing to redo');
			return;
		}
		this.#undoStack.unshift(command);
		if (this.#log) console.log('added to undo stack ', command.action);

		switch (command.action) {
			case 'addClip':
				deleteClip(command.data.clipId, true, true);
				timelineState.invalidate = true;
				break;
			case 'deleteClip':
				deleteClip(command.data.clipId, false, true);
				timelineState.invalidate = true;
				break;
		}
	}
}
