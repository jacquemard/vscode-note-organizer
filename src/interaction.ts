import * as vscode from "vscode";
import NotesDB, { Note } from "./notesdb";
import NoteScanner from "./notescanner";
import ProjectScanner from "./projectscanner";


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

    const allNoteFiles = fileDescs.flatMap(fileDesc => fileDesc.noteFilesPaths);

    // Scan for project
    const projectFinder = new ProjectScanner(allNoteFiles);

    const projectDescs = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        cancellable: true,
    }, async (progress, token) => await projectFinder.searchProjects([progress, token]));

    const projectDescsUniqueByUri = new Map(projectDescs.map(item => [item.projectPath.toString(), item]));
    const projectDescsUniqueByNoteUri = new Map(projectDescs.map(item => [item.rootPath.toString(), item]));

    // Create the project in the DB (not replacing existing ones)
    const notesDB = NotesDB.getInstance(context.globalState);
    notesDB.populateDBFromProjectUris(Array.from(projectDescsUniqueByUri.values()).map(projDesc => projDesc.projectPath).filter(val => val !== null));

    // Create notes in the DB (not replacing existing ones)
    notesDB.populateDBFromNoteUris(allNoteFiles);

    // Update the note which we know the project for
    allNoteFiles.forEach(noteUri => {
        const linkedProjectDesc = projectDescsUniqueByNoteUri.get(noteUri.toString());
        if (linkedProjectDesc) {
            // Find the project and the note from the DB
            const note = notesDB.getNoteFromUri(noteUri);
            const project = notesDB.getProjectFromUri(linkedProjectDesc.projectPath);

            // Update the note to use the project
            if (note && project) {
                note.project = project;
                notesDB.saveNote(note);
            }
        }
    });

    // Persist storage
    notesDB.persistDB();
    vscode.window.showInformationMessage(`Note scanning finished successfully. Found ${allNoteFiles.length} note files, grouped in ${projectDescs.length} projects.`);
}
