import * as vscode from 'vscode';

import { importNoteToProject, clearDatabase, createNewProject, removeNote, removeProject, renameProject, openNoteDialog, scanFolderAndSaveNotesAndProjects, tryImportTextDocument, deleteNoteFromDisk, renameNote, newNoteToProject, newNoteToWorkspace, openDraftFolder, quickNoteToDraft } from './interaction';
import { NotesTreeDataProvider, NotesTreeDragAndDropController } from './treedata';
import { Logging } from './logging';
import { Database } from './db';
import { NoteService } from './services/noteservice';


export function activate(context: vscode.ExtensionContext) {
	// Initialize database
	const notesDB = Database.getInstance(context.globalState);
	notesDB.load();

	// Initialize note service
	const notesService = NoteService.getInstance(notesDB);

	Logging.log('Note Organizer is active.');

	// Commands
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.scanFolderForNotesAndProject', async () => {
		await scanFolderAndSaveNotesAndProjects(context);
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
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.newNoteToWorkspace', async () => {
		newNoteToWorkspace(context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.openDraftFolder', async () => {
		openDraftFolder(context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.quickNoteToDraft', async () => {
		quickNoteToDraft(context);
	}));

	// Document opended
	vscode.workspace.onDidOpenTextDocument((textDocument) => {
		tryImportTextDocument(textDocument, context);
	});

	// Treeview
	const treeView = new NotesTreeDataProvider(notesService, context);
	vscode.window.createTreeView('noteOrganizer', {
		treeDataProvider: treeView,
		showCollapseAll: true,
		dragAndDropController: new NotesTreeDragAndDropController(notesService, context)
	});

	context.subscriptions.push(vscode.commands.registerCommand('noteOrganizer.toggleShowEmptyProjects', async () => {
		treeView.toggleShowEmptyProject();
	}));

	// Set context as a global as some tests depend on it
	(global as any).testExtensionContext = context;

	return context;
}

export function deactivate() { }
function quickNoteToDraf(context: vscode.ExtensionContext) {
	throw new Error('Function not implemented.');
}

