import * as vscode from 'vscode';
import NotesDB, { Project, Note } from './notesdb';


export class NotesTreeDataProvider implements vscode.TreeDataProvider<Node> {
    private _notesDB: NotesDB;

    // Event
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(notesDB: NotesDB) {
        this._notesDB = notesDB;
        notesDB.onDBUpdated(() => this._onDidChangeTreeData.fire(undefined));
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
            const projects = Array.from(this._notesDB.getAllProject()).filter(project => project !== Project.unknownProject).map(project => {
                return {
                    type: NodeType.project,
                    data: project
                } as Node;
            });

            // Also include unknown project notes
            const unknownProjectNotes = Array.from(this._notesDB.getAllNotes()).filter(note => note.project === Project.unknownProject).map(note => {
                return {
                    type: NodeType.note,
                    data: note,
                } as Node;
            });

            return [...unknownProjectNotes, ...projects];

        } else if (element.type === NodeType.project) {
            // Called from project node.
            return Array.from(this._notesDB.getAllNotes()).filter(note => note.project === element.data).map(note => {
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

    private readonly _notesDB: NotesDB;

    constructor(notesDB: NotesDB) {
        this._notesDB = notesDB;
    }

    handleDrag?(source: readonly Node[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // Only note are draggable
        dataTransfer.set(this.mimeType, new vscode.DataTransferItem(source.filter(node => node.type === NodeType.note).map(node => (node.data as Note).uri.toString())));
    }
    handleDrop?(target: Node | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        let mimetypeData = dataTransfer.get(this.mimeType);

        if (!mimetypeData) {
            // Wrong mimetype
            return;
        }

        const sourceNoteUrisStr = mimetypeData.value as String[];
        const sourceNotes = Array.from(this._notesDB.getAllNotes()).filter(note => sourceNoteUrisStr.includes(note.uri.toString()));

        // Find the target project
        let project: Project;

        if (!target) {
            project = Project.unknownProject;
        } else {
            if (target.type === NodeType.project) {
                project = target.data as Project;
            } else if (target.type === NodeType.note) {
                const note = target.data as Note;
                project = note.project;
            }
        }

        // Update database
        sourceNotes.forEach(sourceNote => {
            sourceNote.project = project;
            this._notesDB.saveNote(sourceNote);

        });

        this._notesDB.persistDB();
    }

}

enum NodeType {
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

        this.resourceUri = project.getUri();
        this.contextValue = "project";
        this.description = project.projectID;
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
