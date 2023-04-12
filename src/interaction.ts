import * as vscode from "vscode";
import NotesDB, { Note, Project } from "./notesdb";
import NoteScanner from "./notescanner";
import ProjectScanner from "./projectscanner";
import { Node } from "./treedata";
import { Logging } from "./logging";


async function selectNoteDialog(context: vscode.ExtensionContext) {
    const notesDB = NotesDB.getInstance(context.globalState);

    const quickPicks = Array.from(notesDB.getAllNotes()).map(note => {
        return {
            label: `${note.getFileName()} [${note.project.getDisplayName()}]`,
            detail: note.uri.toString(true),
            note: note,
        } as vscode.QuickPickItem & { note: Note };
    });

    const selected = await vscode.window.showQuickPick(quickPicks, {
        title: "Pick a note",
    });

    if (selected) {
        return selected.note;
    }

    return null;
}

async function selectProjectDialog(context: vscode.ExtensionContext) {
    const notesDB = NotesDB.getInstance(context.globalState);

    const quickPicks = Array.from(notesDB.getAllProject()).map(project => {
        return {
            label: project.getDisplayName(),
            detail: project.projectID,
            project: project,
        } as vscode.QuickPickItem & { project: Project };
    });

    const selected = await vscode.window.showQuickPick(quickPicks, {
        title: "Pick a project",
    });

    if (selected) {
        return selected.project;
    }

    return null;
}


export async function openNoteDialog(context: vscode.ExtensionContext) {
    const selected = await selectNoteDialog(context);

    if (selected) {
        openNote(selected);
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
        Logging.log("No path to scan");
        return;
    }

    Logging.log(`Scanning paths ${uris} for notes files.`);

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

    const projectDescsUniqueByUri = new Map(projectDescs.filter(item => item.projectPath).map(item => [item.projectPath.toString(), item]));
    const projectDescsUniqueByNoteUri = new Map(projectDescs.map(item => [item.rootPath.toString(), item]));

    // Create the project in the DB (not replacing existing ones)
    const notesDB = NotesDB.getInstance(context.globalState);
    notesDB.populateDBFromProjectUris(Array.from(projectDescsUniqueByUri.values()).map(projDesc => projDesc.projectPath).filter(val => val !== null));

    // Create notes in the DB (not replacing existing ones)
    notesDB.populateDBFromNoteUris(allNoteFiles);

    // Update the note which we know the project for, if no project already
    allNoteFiles.forEach(noteUri => {
        const linkedProjectDesc = projectDescsUniqueByNoteUri.get(noteUri.toString());
        if (linkedProjectDesc && linkedProjectDesc.projectPath) {
            // Find the project and the note from the DB
            const note = notesDB.getNoteFromUri(noteUri);

            if (!note || (note.project && note.project !== Project.unknownProject)) {
                return;
            }

            const project = notesDB.getProjectFromUri(linkedProjectDesc.projectPath);

            if (!project) {
                return;
            }

            // Update the note to use the project
            note.project = project;
            notesDB.saveNote(note);
        }
    });

    // Persist storage
    notesDB.persistDB();
    vscode.window.showInformationMessage(`Note scanning finished successfully. Found ${allNoteFiles.length} note files (${projectDescs.length} projects).`);
}


export async function clearDatabase(context: vscode.ExtensionContext) {
    const selected = await vscode.window.showWarningMessage("Are you sure you want to clear the note database? All of the note and projects will be removed from the database, but won't be deleted from the harddrive.", {
        title: "Yes",
        value: "confirmed",
    }, {
        title: "Cancel"
    },);

    if (selected && selected.value === "confirmed") {
        const notesDB = NotesDB.getInstance(context.globalState);
        notesDB.clearDB();
        notesDB.persistDB();

        vscode.window.showInformationMessage("The note database has been cleared!");
    }
}

export async function createNewProject(context: vscode.ExtensionContext) {
    const projectName = await vscode.window.showInputBox({
        title: "New project",
        placeHolder: "My project name",
    });

    if (!projectName) {
        return;
    }

    const notesDB = NotesDB.getInstance(context.globalState);

    // Check if project already exists
    if (Array.from(notesDB.getAllProject()).filter(proj => proj.projectID === projectName || proj.getDisplayName() === projectName).length > 0) {
        await vscode.window.showWarningMessage(`A project with name ${projectName} already exists.`);
        return;
    }

    notesDB.saveProject(new Project(projectName, projectName));
}

export async function deleteProject(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Project)) {
        return;
    }

    const notesDB = NotesDB.getInstance(context.globalState);

    // Check if project is empty
    if (Array.from(notesDB.getAllUsedProject()).filter(proj => proj === node.data).length > 0) {
        const selected = await vscode.window.showWarningMessage("This project contains some notes, which will also be removed from the databse. Are you sure you want to continue?", {
            title: "Yes",
            value: "confirmed",
        }, {
            title: "Cancel",
        });

        if (selected?.value !== "confirmed") {
            return;
        }
    }

    // Delete the linked notes
    Array.from(notesDB.getAllNotes()).filter(note => note.project === node.data).forEach(note => notesDB.deleteNoteByURI(note.uri));

    // Delete project
    notesDB.deleteProjectByID(node.data.projectID);

    notesDB.persistDB();
}


export async function editProjectName(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Project)) {
        return;
    }

    const newName = await vscode.window.showInputBox({
        title: `New project name for ${node.data.getDisplayName()}`,
        value: node.data.projectName,
    });

    if (!newName) {
        return;
    }

    node.data.projectName = newName;

    const notesDB = NotesDB.getInstance(context.globalState);
    notesDB.saveProject(node.data);
    notesDB.persistDB();
}

export async function deleteNote(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Note)) {
        return;
    }

    const notesDB = NotesDB.getInstance(context.globalState);
    notesDB.deleteNoteByURI(node.data.uri);
    notesDB.persistDB();
}


export async function importNoteToProject(node: Node | undefined, context: vscode.ExtensionContext) {
    // Select note
    let noteFiles = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        openLabel: "Import",
        title: "Select note files to import"
    });

    noteFiles = noteFiles || [];

    // Select project
    let project: Project;
    if (node && node?.data instanceof Project) {
        project = node.data;
    } else {
        // project = await selectProjectDialog(context);
        project = Project.unknownProject;
    }

    // Import only those which does not already exists
    const notesDB = NotesDB.getInstance(context.globalState);
    const existingUris = Array.from(notesDB.getAllNotes()).map(note => note.uri.toString());

    noteFiles.filter(file => !existingUris.includes(file.toString())).map(notefile => new Note(notefile, project)).forEach(note => notesDB.saveNote(note));
    notesDB.persistDB();
}

export async function tryImportTextDocument(textDocument: vscode.TextDocument, context: vscode.ExtensionContext) {
    const noteScanner = new NoteScanner();
    const projectScanner = new ProjectScanner([textDocument.uri]);
    const notesDB = NotesDB.getInstance(context.globalState);

    if (noteScanner.isUriANote(textDocument.uri)) {
        const projectDescs = await projectScanner.searchProjects();
        const projectPath = projectDescs[0].projectPath;

        const note = notesDB.addNoteToDBFromUri(textDocument.uri);

        // Add the project if known
        if (projectPath) {
            const project = notesDB.addProjectToDBFromUri(projectPath);
            note.project = project;
            notesDB.saveNote(note);
        }

    }
}
