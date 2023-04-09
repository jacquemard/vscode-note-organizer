import * as vscode from 'vscode';

import NotesDB from './notesdb';
import { openNoteDialog, scanFolderAndSaveNotes } from './interaction';


export function activate(context: vscode.ExtensionContext) {
	// Load the notes from the DB
	NotesDB.getInstance(context.globalState).loadFromPersistantStorage();
	console.log('"note-organizer" is active.');

	let scanNotesDisposable = vscode.commands.registerCommand('noteOrganizer.scanFolderForNotes', async () => {
		await scanFolderAndSaveNotes(context);
	});
	context.subscriptions.push(scanNotesDisposable);

	let openNoteDisposable = vscode.commands.registerCommand('noteOrganizer.openNote', async () => {
		openNoteDialog(context);
	});
	context.subscriptions.push(openNoteDisposable);

}

export function deactivate() { }
