import * as vscode from "vscode";
import { Database } from "./db";
import { NoteService } from "./services/noteservice";
import IgnoreNoteService from "./services/ignoreNotesService";

export type ProgressDesc = [progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken];
export type NonCancelableProgressDesc = [progress: vscode.Progress<{ message?: string; increment?: number }>, token: null];

export function getNoteService(context: vscode.ExtensionContext) {
    const notesDB = Database.getInstance(context.globalState);
    const noteService = NoteService.getInstance(notesDB);

    return noteService;
}

export function getIgnoreNoteService(context: vscode.ExtensionContext) {
    const notesDB = Database.getInstance(context.globalState);
    const service = IgnoreNoteService.getInstance(notesDB);

    return service;
}

export function getFileName(uri: vscode.Uri) {
    const pathParts = uri.path.split('/').filter(Boolean);
    const fileName = pathParts[pathParts.length - 1];

    return fileName;
}

export function getOrCreateProject(uri: vscode.Uri, context: vscode.ExtensionContext) {
    const noteService = getNoteService(context);
    let project = noteService.getAllProjects().find(proj => proj.uri.toString() === uri.toString());

    if (!project) {
        // Create the project if non existant
        project = noteService.newProject(uri, getFileName(uri));
    }

    return project;
}
