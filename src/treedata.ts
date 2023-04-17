import * as vscode from 'vscode';
import { NoteService, Project, Note } from './services/noteservice';
import { getFileName } from './utils';


export class NotesTreeDataProvider implements vscode.TreeDataProvider<Node> {
    private _notesService: NoteService;

    // Event
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(notesService: NoteService) {
        this._notesService = notesService;
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
            const projects = Array.from(this._notesService.getAllProjects()).map(project => {
                return {
                    type: NodeType.project,
                    data: project
                } as Node;
            });

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

}

export class NotesTreeDragAndDropController implements vscode.TreeDragAndDropController<Node> {
    public readonly mimeType = "application/vnd.code.tree.noteOrganizer";
    public readonly dropMimeTypes = [this.mimeType];
    public readonly dragMimeTypes = [this.mimeType];

    private readonly _notesService: NoteService;

    constructor(notesService: NoteService) {
        this._notesService = notesService;
    }

    handleDrag?(source: readonly Node[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // Only note are draggable
        dataTransfer.set(this.mimeType, new vscode.DataTransferItem(source.filter(node => node.type === NodeType.note).map(node => (node.data as Note).uri.toString())));
    }
    handleDrop?(target: Node | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // Handle dragged notes only
        let mimetypeData = dataTransfer.get(this.mimeType);

        if (!mimetypeData) {
            // Wrong mimetype
            return;
        }

        const sourceNoteUrisStr = mimetypeData.value as String[];
        const sourceNotes = this._notesService.getAllNotes().filter(note => sourceNoteUrisStr.includes(note.uri.toString()));

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
