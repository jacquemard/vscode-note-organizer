import * as vscode from "vscode";
import NoteScanner from "./notescanner";
import ProjectScanner from "./projectscanner";
import { Node, NodeType } from "./treedata";
import { Logging } from "./logging";
import { Database } from "./db";
import { Note, NoteService, Project } from "./services/noteservice";
import { getFileName, getNoteService, getOrCreateProject, getIgnoreNoteService } from "./utils";
import DraftFolderService from "./services/draftfolderservice";
import IgnoreNoteService from "./services/ignoreNotesService";

// Utils -----

async function selectNoteDialog(context: vscode.ExtensionContext) {
    const noteService = getNoteService(context);

    const quickPicks = Array.from(noteService.getAllNotes()).map(note => {
        const projectName = note.project?.getDisplayName();
        return {
            label: `${note.getFileName()} [${projectName || "No project"}]`,
            detail: note.uri.fsPath,
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
    const noteService = getNoteService(context);

    const quickPicks = Array.from(noteService.getAllProjects()).map(project => {
        return {
            label: project.getDisplayName(),
            detail: project.uri.fsPath,
            project: project,
        } as vscode.QuickPickItem & { project: Project };
    });

    const selected = await vscode.window.showQuickPick(quickPicks, {
        title: "Pick a project",
    });

    if (selected) {
        return selected.project;
    }

    return undefined;
}

async function tryNewNoteAt(uri: vscode.Uri, project: Project | undefined, context: vscode.ExtensionContext) {
    const noteService = getNoteService(context);
    const ignoreNoteService = getIgnoreNoteService(context);

    try {
        const fileStat = await vscode.workspace.fs.stat(uri);

        if (fileStat.type === vscode.FileType.File) {
            // Already existing files, add it as the note does not already exists
            let existingNote = noteService.getAllNotes().find(note => note.uri.toString() === uri.toString());

            if (!existingNote) {
                existingNote = noteService.newNote(uri, project);
                ignoreNoteService.removeUriFromIgnoreNotes(uri);
            }

            await openNote(existingNote);
        }
    } catch (error) {
        // File does not exists, create it
        await vscode.workspace.fs.writeFile(uri, new Uint8Array());

        // Add it to the database
        const note = noteService.newNote(uri, project);
        ignoreNoteService.removeUriFromIgnoreNotes(uri);

        await openNote(note);
    }
}

// --- Commands

export async function openNoteDialog(context: vscode.ExtensionContext) {
    const selected = await selectNoteDialog(context);

    if (selected) {
        openNote(selected);
    }

}


export function openNote(note: Note) {
    return vscode.window.showTextDocument(note.uri);
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
    const noteService = getNoteService(context);
    const projectFinder = new ProjectScanner(allNoteFiles, noteService.getAllProjects().map(proj => proj.uri));

    let projectDescs = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        cancellable: true,
    }, async (progress, token) => await projectFinder.searchProjects([progress, token]));

    // Also consider existing project in projectDescs

    // TODO: Maybe introduce a "parent project" feature, i.e. a project with a parent ?

    const projectDescsUniqueByUri = new Map(projectDescs.filter(item => item.projectPath).map(item => [item.projectPath.toString(), item]));
    const projectDescsUniqueByNoteUri = new Map(projectDescs.map(item => [item.rootPath.toString(), item]));

    // Create the project in the DB (not replacing existing ones)
    Array.from(projectDescsUniqueByUri.values()).map(projDesc => projDesc.projectPath).filter(val => val !== null).forEach(uri => {
        // Check if URI exists
        const existingProject = noteService.getAllProjects().find(proj => proj.uri.toString() === uri.toString());

        if (!existingProject) {
            noteService.newProject(uri, getFileName(uri));
        }
    });

    const ignoreNoteService = getIgnoreNoteService(context);
    // Create notes in the DB (not replacing existing ones)
    allNoteFiles.forEach(uri => {
        // Check if URI exists
        const existingNote = noteService.getAllNotes().find(note => note.uri.toString() === uri.toString());

        if (!existingNote) {
            noteService.newNote(uri);
            ignoreNoteService.removeUriFromIgnoreNotes(uri);
        }
    });

    // Update the note which we know the project for, if no project already
    allNoteFiles.forEach(noteUri => {
        const linkedProjectDesc = projectDescsUniqueByNoteUri.get(noteUri.toString());
        if (linkedProjectDesc && linkedProjectDesc.projectPath) {
            // Find the project and the note from the DB
            const note = noteService.getAllNotes().find(note => note.uri.toString() === noteUri.toString());

            if (!note || note.project) {
                return;
            }

            const project = noteService.getAllProjects().find(proj => proj.uri.toString() === linkedProjectDesc.projectPath.toString());

            if (!project) {
                return;
            }

            // Update the note to use the project
            note.project = project;
        }
    });

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
        const noteService = getNoteService(context);
        noteService.clear();

        vscode.window.showInformationMessage("The note database has been cleared!");
    }
}

export async function createNewProject(context: vscode.ExtensionContext) {
    // Open folder
    let projectFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Open",
        title: "Select the project folder"
    });

    if (!projectFolder) {
        return;
    }

    const noteService = getNoteService(context);
    const newProj = noteService.newProject(projectFolder[0]);

    renameProject({
        type: NodeType.project,
        data: newProj
    }, context);

    // Let ask if the user want to scan the project

    const selected = await vscode.window.showInformationMessage(`Would you like to scan the folder ${getFileName(newProj.uri)} for note ?`, {}, {
        title: "Yes",
        confirmed: true,
    }, {
        title: "No, thanks",
        confirmed: false,
    });

    if (!selected || !selected.confirmed) {
        return;
    }

    // Scan of the project
    scanUrisAndSaveNotes([newProj.uri], context);
}

export async function removeProject(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Project)) {
        return;
    }

    const noteService = getNoteService(context);
    const ignoreNoteService = getIgnoreNoteService(context);

    // Check if project is empty
    if (noteService.getAllNotes().filter(note => note.project === node.data).length > 0) {
        const selected = await vscode.window.showWarningMessage("This project contains some notes, which will be removed from the database, but not from the hardrive. Are you sure you want to continue?", {
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
    Array.from(noteService.getAllNotes()).filter(note => note.project === node.data).forEach(note => {
        noteService.removeNote(note);
        ignoreNoteService.addUriToIgnoreNotes(note.uri);
    });

    // Delete project
    noteService.removeProject(node.data);
}


export async function renameProject(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Project)) {
        return;
    }

    const newName = await vscode.window.showInputBox({
        title: `New project name for ${node.data.getDisplayName()}`,
        value: node.data.getDisplayName(),
        prompt: "This will have no impact on the hardrive, the name will only be updated in the local database."
    });

    if (!newName) {
        return;
    }

    node.data.name = newName;
}

export async function removeNote(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Note)) {
        return;
    }

    const noteService = getNoteService(context);
    const ignoreNoteService = getIgnoreNoteService(context);

    noteService.removeNote(node.data);
    ignoreNoteService.addUriToIgnoreNotes(node.data.uri);
}

export async function deleteNoteFromDisk(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Note)) {
        return;
    }

    const selected = await vscode.window.showWarningMessage("Are you sure you want to delete this note? It will be removed from the disk.", {
        title: "Yes",
        value: "confirmed",
    }, {
        title: "Cancel"
    },);

    if (selected && selected.value === "confirmed") {
        removeNote(node, context);
        await vscode.workspace.fs.delete(node.data.uri);
    }

}

export async function renameNote(node: Node, context: vscode.ExtensionContext) {
    if (!(node.data instanceof Note)) {
        return;
    }

    const filePathParts = node.data.uri.path.split('/');
    const fileName = filePathParts[filePathParts.length - 1];

    const newName = await vscode.window.showInputBox({
        title: "Please enter the note new name",
        placeHolder: "New Note Name",
        value: fileName,
    });

    if (newName) {
        const parentPath = node.data.uri.with({
            path: filePathParts.slice(0, filePathParts.length - 1).join("/")
        });
        const newUri = vscode.Uri.joinPath(parentPath, newName);

        // Rename on disk
        try {
            await vscode.workspace.fs.rename(node.data.uri, newUri);

            // Rename on DB and update removed notes
            const ignoreNoteService = getIgnoreNoteService(context);
            ignoreNoteService.removeUriFromIgnoreNotes(newUri);
            ignoreNoteService.removeUriFromIgnoreNotes(node.data.uri);

            node.data.uri = newUri;

        } catch (error) {
            vscode.window.showWarningMessage(`Error while renaming note: ${error}`);
        }
    }

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
    let project: Project | undefined = undefined;
    if (node && node?.data instanceof Project) {
        project = node.data;
    }

    // Import only those which does not already exists
    const noteService = getNoteService(context);
    const ignoreNoteService = getIgnoreNoteService(context);
    const existingUris = Array.from(noteService.getAllNotes()).map(note => note.uri.toString());

    noteFiles.filter(file => !existingUris.includes(file.toString())).forEach(notefile => {
        noteService.newNote(notefile, project);
        ignoreNoteService.removeUriFromIgnoreNotes(notefile);
    });
}


export async function newNoteToProject(node: Node | undefined, context: vscode.ExtensionContext) {
    // Find project if not known
    let project: Project | undefined;

    if (!node || node.type !== NodeType.project) {
        project = await selectProjectDialog(context);
    } else {
        project = node.data as Project;
    }

    if (!project) {
        return;
    }

    // Ask note name
    let noteName = await vscode.window.showInputBox({
        title: "Note name",
        placeHolder: "My new note",
    });

    if (!noteName) {
        return;
    }

    const newFilePath = vscode.Uri.joinPath(project.uri, noteName);

    await tryNewNoteAt(newFilePath, project, context);
}



export async function newNoteToWorkspace(context: vscode.ExtensionContext) {
    const folders = vscode.workspace.workspaceFolders;

    let pickedFolder;
    if (!folders || folders.length === 0) {
        await vscode.window.showWarningMessage("No workspace opened, cannot create a note");
        return;
    } else if (folders.length > 1) {
        const quickPicks = folders.map(folder => {
            return {
                label: folder.name,
                detail: folder.uri.fsPath,
                workspace: folder
            };
        });

        const selected = await vscode.window.showQuickPick(quickPicks, {
            title: "Pick a workspace",
        });

        if (!selected) {
            return;
        }
        pickedFolder = selected.workspace;

    } else {
        pickedFolder = folders[0];
    }

    // Ask note name
    let noteName = await vscode.window.showInputBox({
        title: "Note name",
        placeHolder: "My new note",
    });

    if (!noteName) {
        return;
    }

    // Get the project
    const project = getOrCreateProject(pickedFolder.uri, context);

    const noteService = getNoteService(context);
    const ignoreNoteService = getIgnoreNoteService(context);

    // Create the note if not on disk already
    const newFilePath = vscode.Uri.joinPath(project.uri, noteName);
    try {
        const fileStat = await vscode.workspace.fs.stat(newFilePath);

        if (fileStat.type === vscode.FileType.File) {
            // Already existing files, add it as the note does not already exists
            let existingNote = noteService.getAllNotes().find(note => note.uri.toString() === newFilePath.toString());

            if (!existingNote) {
                existingNote = noteService.newNote(newFilePath, project);
                ignoreNoteService.removeUriFromIgnoreNotes(newFilePath);
            }

            await openNote(existingNote);

        }
    } catch (error) {
        // File does not exists, create it
        await vscode.workspace.fs.writeFile(newFilePath, new Uint8Array());

        // Add it to the database
        const note = noteService.newNote(newFilePath, project);
        ignoreNoteService.removeUriFromIgnoreNotes(newFilePath);
        await openNote(note);
    }
}


export async function tryImportTextDocument(textDocument: vscode.TextDocument, context: vscode.ExtensionContext) {
    const noteScanner = new NoteScanner();
    const ignoreNoteService = getIgnoreNoteService(context);

    // Adds the note only if it is a note based on the filename and if it has not been removed
    if (noteScanner.isUriANote(textDocument.uri) && !ignoreNoteService.isNoteUriRemoved(textDocument.uri)) {
        const noteService = getNoteService(context);
        const projectScanner = new ProjectScanner([textDocument.uri], noteService.getAllProjects().map(proj => proj.uri));

        const projectDescs = await projectScanner.searchProjects();
        const projectPath = projectDescs[0].projectPath;
        const existingNoteUris = noteService.getAllNotes().map(note => note.uri.toString());

        if (existingNoteUris.includes(textDocument.uri.toString())) {
            return;
        }

        let project: Project | undefined = undefined;

        if (projectPath) {
            project = getOrCreateProject(projectPath, context);
        }

        const note = noteService.newNote(textDocument.uri, project);

    }
}

export async function openDraftFolder(context: vscode.ExtensionContext) {
    const draftService = DraftFolderService.getInstance(context);

    vscode.commands.executeCommand("vscode.openFolder", draftService.getDraftFolder(), {
        forceNewWindow: true,
    });
}

export async function quickNoteToDraft(context: vscode.ExtensionContext) {
    // Ask note name
    let noteName = await vscode.window.showInputBox({
        title: "Note name",
        placeHolder: "My new note",
    });

    if (!noteName) {
        return;
    }

    const draftService = DraftFolderService.getInstance(context);

    const newFilePath = vscode.Uri.joinPath(draftService.getDraftFolder(), noteName);

    tryNewNoteAt(newFilePath, undefined, context);


}
