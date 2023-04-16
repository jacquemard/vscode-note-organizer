import * as vscode from "vscode";
import { Database } from "./db";
import { NoteService } from "./noteservice";

export type ProgressDesc = [progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken];
export type NonCancelableProgressDesc = [progress: vscode.Progress<{ message?: string; increment?: number }>, token: null];

export function getNoteService(context: vscode.ExtensionContext) {
    const notesDB = Database.getInstance(context.globalState);
    const noteService = NoteService.getInstance(notesDB);

    return noteService;
}

export function getFileName(uri: vscode.Uri) {
    const pathParts = uri.path.split('/').filter(Boolean);
    const fileName = pathParts[pathParts.length - 1];

    return fileName;
}
