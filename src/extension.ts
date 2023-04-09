// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import NoteScanner from './notescanner';
import NotesDB from './notesdb';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('"note-organizer" is active.');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let findNotesdisposable = vscode.commands.registerCommand('note-organizer.findNotes', async () => {
		const uri = vscode.Uri.file("C:/Users/jacqu/OneDrive/Documents");

		const noteFinder = new NoteScanner();
		noteFinder.paths = [uri];

		// Scan for notes
		const fileDescs = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			cancellable: true,
		}, async (progress, token) => await noteFinder.findNotesDocs([progress, token]));
		console.log(fileDescs);

		// Save them in DB
		const notesDB = new NotesDB(context.globalState);
		notesDB.populateDBFromNoteUris(fileDescs.flatMap(fileDesc => fileDesc.noteFilesPaths));

		// Persist storage
		notesDB.persistDB();

		const notesDB2 = new NotesDB(context.globalState);
		notesDB2.loadFromPersistantStorage();

		for (let note of notesDB2.getAllNotes()) {
			console.log(note);
		}
	});

	context.subscriptions.push(findNotesdisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
