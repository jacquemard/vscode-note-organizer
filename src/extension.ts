import * as vscode from 'vscode';

import NotesDB from './notesdb';
import { openNoteDialog, scanFolderAndSaveNotes } from './interaction';
import { NotesTreeDataProvider } from './treedata';


export function activate(context: vscode.ExtensionContext) {
	// Load the notes from the DB
	const notesDB = NotesDB.getInstance(context.globalState);
	notesDB.loadFromPersistantStorage();
	console.log('"note-organizer" is active.');

	// Commands
	let scanNotesDisposable = vscode.commands.registerCommand('noteOrganizer.scanFolderForNotes', async () => {
		await scanFolderAndSaveNotes(context);
	});
	context.subscriptions.push(scanNotesDisposable);

	let openNoteDisposable = vscode.commands.registerCommand('noteOrganizer.openNote', async () => {
		openNoteDialog(context);
	});
	context.subscriptions.push(openNoteDisposable);

	// Treeview
	vscode.window.registerTreeDataProvider('noteOrganizer', new NotesTreeDataProvider(notesDB));

}

export function deactivate() { }
