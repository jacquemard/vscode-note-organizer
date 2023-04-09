// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import NoteScanner from './notescanner';
import NotesDB from './notesdb';
import { openNoteDialog, scanAndSaveNotes } from './interaction';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Load the notes from the DB
	NotesDB.getInstance(context.globalState).loadFromPersistantStorage();
	console.log('"note-organizer" is active.');

	let scanNotesDisposable = vscode.commands.registerCommand('note-organizer.scanNotes', async () => {
		await scanAndSaveNotes(context);
	});
	context.subscriptions.push(scanNotesDisposable);

	let openNoteDisposable = vscode.commands.registerCommand('note-organizer.openNote', async () => {
		openNoteDialog(context);
	});
	context.subscriptions.push(openNoteDisposable);

}

// This method is called when your extension is deactivated
export function deactivate() { }
