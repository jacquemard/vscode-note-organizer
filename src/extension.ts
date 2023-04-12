import * as vscode from 'vscode';

import NotesDB from './notesdb';
import { importNoteToProject, clearDatabase, createNewProject, deleteNote, deleteProject, editProjectName, openNoteDialog, scanFolderAndSaveNotes, tryImportTextDocument } from './interaction';
import { NotesTreeDataProvider, NotesTreeDragAndDropController } from './treedata';


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
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.editProjectName', async (node) => {
		editProjectName(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.deleteNote', async (node) => {
		deleteNote(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.importNoteToProject', async (node) => {
		importNoteToProject(node, context);
	}));

	// Document opended
	vscode.workspace.onDidOpenTextDocument((textDocument) => {
		tryImportTextDocument(textDocument, context);
	});

	// Treeview
	// vscode.window.registerTreeDataProvider('noteOrganizer', new NotesTreeDataProvider(notesDB));

	vscode.window.createTreeView('noteOrganizer', {
		treeDataProvider: new NotesTreeDataProvider(notesDB),
		showCollapseAll: true,
		dragAndDropController: new NotesTreeDragAndDropController(notesDB)
	});

	// Set context as a global as some tests depend on it
	(global as any).testExtensionContext = context;

	return context;
}

export function deactivate() { }
