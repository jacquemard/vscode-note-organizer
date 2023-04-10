import * as vscode from 'vscode';

import NotesDB from './notesdb';
import { clearDatabase, createNewProject, deleteProject, openNoteDialog, scanFolderAndSaveNotes } from './interaction';
import { NotesTreeDataProvider } from './treedata';


export function activate(context: vscode.ExtensionContext) {
	// Load the notes from the DB
	const notesDB = NotesDB.getInstance(context.globalState);
	notesDB.loadFromPersistantStorage();
	console.log('"note-organizer" is active.');

	// Commands
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.scanFolderForNotes', async () => {
		await scanFolderAndSaveNotes(context);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.openNote', async () => {
		openNoteDialog(context);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.clearDatabase', async () => {
		clearDatabase(context);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.createProject', async () => {
		createNewProject(context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.deleteProject', async (node) => {
		deleteProject(node, context);
	}));

	// Treeview
	vscode.window.registerTreeDataProvider('noteOrganizer', new NotesTreeDataProvider(notesDB));

}

export function deactivate() { }
