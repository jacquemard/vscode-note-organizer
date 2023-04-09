import * as vscode from "vscode";


// export class Project {
//     public readonly path: vscode.Uri;  // Used as identifier
//     public readonly displayName?: string; // Overrides the name displayed

//     constructor(path: vscode.Uri, displayName: string) {
//         this.displayName = displayName;
//         this.path = path;
//     }
// }

export class Note {
    public readonly uri: vscode.Uri;  // used as identifier
    // public readonly project?: Project;

    constructor(uri: vscode.Uri) {
        this.uri = uri;
        // this.project = project;
    }

    public getFileName() {
        const parts = this.uri.path.split('/');
        return parts[parts.length - 1];
    }
}


interface RawNote {
    uri: vscode.Uri
}


export default class NotesDB {
    public readonly storageKey = "notesDB";

    private _globalState: vscode.Memento;

    private _notesDB = new Map<vscode.Uri, Note>();
    // private _project: Array<Project> = [];

    constructor(globalState: vscode.Memento) {
        this._globalState = globalState;
    }

    /**
     * Return all of the notes
     */
    public getAllNotes() {
        return this._notesDB.values();
    }

    /**
     * Return a saved note based on its URI, if any
     * @param noteUri The note location uri
     * @returns The saved Note, if any
     */
    public getNoteFromUri(noteUri: vscode.Uri) {
        return this._notesDB.get(noteUri);
    }

    /**
     * Adds the given noteURI to the DB. Replace it if it already exists
     * @param noteUri The note location uri.
     */
    public addNoteToDBFromUri(noteUri: vscode.Uri) {
        this._notesDB.set(noteUri, new Note(
            noteUri
        ));
    }

    /**
     * Adds the given noteURIs to the DB. Replace them if they already exist.
     * @param notesUris The note location uris.
     */
    public populateDBFromNoteUris(notesUris: Iterable<vscode.Uri>) {
        for (const note of notesUris) {
            this.addNoteToDBFromUri(note);
        }
    }

    /**
     * Persists the DB in the extension storage
     */
    public persistDB() {
        this._globalState.update(this.storageKey, this._notesDB);
    }

    /**
     * Load the DB from the persistant storage
     */
    public loadFromPersistantStorage() {
        this._notesDB = this._globalState.get(this.storageKey, new Map()) as Map<vscode.Uri, Note>;
    }
}
