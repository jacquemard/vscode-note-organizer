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


export async function scanAndSaveNotes(context: vscode.ExtensionContext) {
    const uri = vscode.Uri.file("C:/Users/jacqu/OneDrive/Documents/Project");  // TODO from settings

    const noteFinder = new NoteScanner([uri]);

    // Scan for notes
    const fileDescs = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        cancellable: true,
    }, async (progress, token) => await noteFinder.scanNotesDocs([progress, token]));

    // Save them in DB
    const notesDB = NotesDB.getInstance(context.globalState);
    notesDB.populateDBFromNoteUris(fileDescs.flatMap(fileDesc => fileDesc.noteFilesPaths));

    // Persist storage
    notesDB.persistDB();
}
