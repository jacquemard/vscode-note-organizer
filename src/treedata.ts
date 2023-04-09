import * as vscode from 'vscode';
import NotesDB from './notesdb';
import { Note } from './notesdb';

export class NotesTreeDataProvider implements vscode.TreeDataProvider<NoteItem> {
    private _notesDB: NotesDB;

    // Event
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(notesDB: NotesDB) {
        this._notesDB = notesDB;
        notesDB.onDBUpdated(() => this._onDidChangeTreeData.fire(undefined));

    }
    getTreeItem(element: NoteItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: NoteItem | undefined): vscode.ProviderResult<NoteItem[]> {
        if (!element) {
            // Called for the root element
            return Array.from(this._notesDB.getAllNotes()).map(note => new NoteItem(note));
        }

        return [];
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
    }
}
