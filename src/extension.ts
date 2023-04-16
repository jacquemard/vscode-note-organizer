import * as vscode from 'vscode';

import { importNoteToProject, clearDatabase, createNewProject, removeNote, removeProject, renameProject, openNoteDialog, scanFolderAndSaveNotes, tryImportTextDocument, deleteNoteFromDisk, renameNote, newNoteToProject } from './interaction';
import { NotesTreeDataProvider, NotesTreeDragAndDropController } from './treedata';
import { Logging } from './logging';
import { Database } from './db';
import { NoteService } from './noteservice';


export function activate(context: vscode.ExtensionContext) {
	// Load the notes from the DB
	const notesDB = Database.getInstance(context.globalState);
	notesDB.load();
	const notesService = NoteService.getInstance(notesDB);

	// TODO: vscode.workspace.createFileSystemWatcher

	Logging.log('Note Organizer is active.');

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
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.removeProject', async (node) => {
		removeProject(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.renameProject', async (node) => {
		renameProject(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.renameNote', async (node) => {
		renameNote(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.removeNote', async (node) => {
		removeNote(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.deleteNoteFromDisk', async (node) => {
		deleteNoteFromDisk(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.importNoteToProject', async (node) => {
		importNoteToProject(node, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.newNoteToProject', async (node) => {
		newNoteToProject(node, context);
	}));


	// Document opended
	vscode.workspace.onDidOpenTextDocument((textDocument) => {
		tryImportTextDocument(textDocument, context);
	});

	// Treeview
	// vscode.window.registerTreeDataProvider('noteOrganizer', new NotesTreeDataProvider(notesDB));

	vscode.window.createTreeView('noteOrganizer', {
		treeDataProvider: new NotesTreeDataProvider(notesService),
		showCollapseAll: true,
		dragAndDropController: new NotesTreeDragAndDropController(notesService)
	});

	// Set context as a global as some tests depend on it
	(global as any).testExtensionContext = context;

	return context;
}

export function deactivate() { }
