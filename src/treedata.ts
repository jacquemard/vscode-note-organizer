import * as vscode from 'vscode';
import { NoteService, Project, Note } from './services/noteservice';
import { getFileName } from './utils';
import { createNewProject } from './interaction';


export class NotesTreeDataProvider implements vscode.TreeDataProvider<Node> {
    private _notesService: NoteService;
    private _context: vscode.ExtensionContext;

    private readonly showEmptyProjectStorageKey = "showEmptyProjects";

    // Event
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(notesService: NoteService, context: vscode.ExtensionContext) {
        this._notesService = notesService;
        this._context = context;
        notesService.onUpdated(() => this._onDidChangeTreeData.fire(undefined));
    }

    getTreeItem(element: Node): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element.type === NodeType.note && element.data instanceof Note) {
            return new NoteItem(element.data);
        } else if (element.type === NodeType.project && element.data instanceof Project) {
            return new ProjectItem(element.data);
        }

        return new vscode.TreeItem("Error");
    }

    getChildren(element?: Node | undefined): vscode.ProviderResult<Node[]> {
        if (!element) {
            // Called for the root element
            let projects = Array.from(this._notesService.getAllProjects()).map(project => {
                return {
                    type: NodeType.project,
                    data: project
                } as Node;
            });

            if (!this.getShowEmptyProject()) {
                // Filter out empty projects
                projects = projects.filter(proj => {
                    return this._notesService.getAllNotes().filter(note => note.project && note.project.id === proj.data.id).length > 0;
                });
            }

            // Also include unknown project notes
            const unknownProjectNotes = Array.from(this._notesService.getAllNotes()).filter(note => !note.project).map(note => {
                return {
                    type: NodeType.note,
                    data: note,
                } as Node;
            });

            return [...unknownProjectNotes, ...projects];

        } else if (element.type === NodeType.project) {
            // Called from project node.
            return Array.from(this._notesService.getAllNotes()).filter(note => note.project === element.data).map(note => {
                return {
                    type: NodeType.note,
                    data: note,
                } as Node;
            });
        };

        return [];
    }

    public getShowEmptyProject() {
        return this._context.globalState.get(this.showEmptyProjectStorageKey, true);
    }

    public setShowEmptyProject(value: Boolean) {
        this._context.globalState.update(this.showEmptyProjectStorageKey, value);
        this._onDidChangeTreeData.fire(undefined);
    }

    public toggleShowEmptyProject() {
        this.setShowEmptyProject(!this.getShowEmptyProject());
    }
}

export class NotesTreeDragAndDropController implements vscode.TreeDragAndDropController<Node> {
    public readonly mimeType = "application/vnd.code.tree.noteOrganizer";
    public readonly dropMimeTypes = [this.mimeType, "text/uri-list"];
    public readonly dragMimeTypes = [this.mimeType];

    private readonly _notesService: NoteService;
    private readonly _context: vscode.ExtensionContext;

    constructor(notesService: NoteService, context: vscode.ExtensionContext) {
        this._notesService = notesService;
        this._context = context;
    }

    handleDrag(source: readonly Node[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // Only note are draggable
        dataTransfer.set(this.mimeType, new vscode.DataTransferItem(source.filter(node => node.type === NodeType.note).map(node => (node.data as Note).uri.toString())));
    }
    handleDrop(target: Node | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
        this._handleDrop(target, dataTransfer, token);
    }

    async _handleDrop(target: Node | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
        let fileUriMimeTypeData = dataTransfer.get("text/uri-list");
        dataTransfer.forEach((item, mimeType) => {
            console.log(item);
            console.log(mimeType);
        });

        if (!fileUriMimeTypeData) {
            // Wrong mimetype
            return;
        }

        // Handle dragged file or folder (including notes from treeview)

        // Split dragged by file for folder
        const sourceFileUrisStr = (fileUriMimeTypeData.value as string).split(/(\s+)/).map(s => s.trim()).filter(Boolean);
        const sourceFileUris = sourceFileUrisStr.map(str => vscode.Uri.parse(str));
        const filesUri: vscode.Uri[] = [];
        const folderUri: vscode.Uri[] = [];

        for (const sourceFileUri of sourceFileUris) {
            const stat = await vscode.workspace.fs.stat(sourceFileUri);
            if (stat.type === vscode.FileType.Directory) {
                folderUri.push(sourceFileUri);
            } else if (stat.type === vscode.FileType.File) {
                filesUri.push(sourceFileUri);
            }
        }
        // Find the target project
        let project: Project | undefined = undefined;

        if (target) {
            if (target.type === NodeType.project) {
                project = target.data as Project;
            } else if (target.type === NodeType.note) {
                const note = target.data as Note;
                project = note.project;
            }
        }

        // Find existing notes or create one
        const sourceNotes = filesUri.map(uri => {
            let note = this._notesService.getAllNotes().find(note => note.uri.toString() === uri.toString());

            if (!note) {
                note = this._notesService.newNote(uri);
            };

            return note;
        });

        // Update service
        sourceNotes.forEach(async sourceNote => {
            // Also physically move it if there is a project

            if (project) {
                const newFilePath = vscode.Uri.joinPath(project.uri, getFileName(sourceNote.uri));
                try {
                    await vscode.workspace.fs.rename(sourceNote.uri, newFilePath);
                    sourceNote.uri = newFilePath;
                    sourceNote.project = project;
                } catch (error) {
                    vscode.window.showWarningMessage(`Error while renaming note: ${error}`);
                }
            } else {
                sourceNote.project = project;
            }
        });

        // Handle folder drop
        // Create new projects if not already exists
        const folderProjects = folderUri.forEach(uri => {
            let project = this._notesService.getAllProjects().find(project => project.uri.toString() === uri.toString());

            if (!project) {
                createNewProject(this._context, uri);
            };
        });

    }

}

export enum NodeType {
    project,
    note
}

export interface Node {
    type: NodeType,
    data: Project | Note
}


class ProjectItem extends vscode.TreeItem {
    constructor(project: Project) {
        super(
            project.getDisplayName(),
            vscode.TreeItemCollapsibleState.Expanded,
        );

        this.resourceUri = project.uri;
        this.contextValue = "project";
        this.description = getFileName(project.uri);
        this.iconPath = new vscode.ThemeIcon("file-directory");
    }
}

class NoteItem extends vscode.TreeItem {
    constructor(note: Note) {
        super(
            note.getFileName()
        );

        this.resourceUri = note.uri;
        this.command = {
            title: "open",
            command: 'vscode.open',
            arguments: [note.uri]
        };
        this.contextValue = "note";
    }
}
