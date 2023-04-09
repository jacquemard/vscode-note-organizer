import * as vscode from "vscode";
import NotesDB, { Note } from "./notesdb";
import NoteScanner from "./notescanner";


export async function openNoteDialog(context: vscode.ExtensionContext) {
    const notesDB = NotesDB.getInstance(context.globalState);

    const quickPicks = Array.from(notesDB.getAllNotes()).map(note => {
        return {
            label: note.getFileName(),
            detail: note.uri.toString(true),
            note: note,
        } as vscode.QuickPickItem & { note: Note };
    });

    const selected = await vscode.window.showQuickPick(quickPicks, {
        title: "Pick a note to open",
    });

    if (selected) {
        openNote(selected.note);
    }

}


export function openNote(note: Note) {
    vscode.window.showTextDocument(note.uri);
}


export async function scanFolderAndSaveNotes(context: vscode.ExtensionContext) {
    let folders = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: "Scan",
        title: "Select folders to scan for notes"
    });

    folders = folders || [];

    return await scanUrisAndSaveNotes(folders, context);
}

export async function scanUrisAndSaveNotes(uris: Array<vscode.Uri>, context: vscode.ExtensionContext) {
    if (uris.length <= 0) {
        vscode.window.showInformationMessage("No path to scan.");
        return;
    }

    vscode.window.showInformationMessage(`Scanning paths ${uris} for notes files.`);

    const noteFinder = new NoteScanner(uris);

    // Scan for notes
    const fileDescs = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        cancellable: true,
    }, async (progress, token) => await noteFinder.scanNotesDocs([progress, token]));

    // Save them in DB
    const notesDB = NotesDB.getInstance(context.globalState);
    const allFiles = fileDescs.flatMap(fileDesc => fileDesc.noteFilesPaths);
    notesDB.populateDBFromNoteUris(allFiles);

    // Persist storage
    notesDB.persistDB();
    vscode.window.showInformationMessage(`Note scanning finished successfully. Found ${allFiles.length} note files.`);
}
