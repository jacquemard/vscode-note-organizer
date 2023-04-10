import * as vscode from "vscode";

export class Project {
    public projectID: string;  // used as identifier
    public projectName?: string;

    constructor(projectID: string, projectName?: string) {
        this.projectID = projectID;
        this.projectName = projectName;
    }

    public static readonly unknownProject = new Project("unknown", "Unclassified");

    public getDisplayName() {
        return this.projectName || this.projectID;
    }

    /**
     * Try to parse projectID to see if it is an URI
     */
    public getUri() {
        return vscode.Uri.parse(this.projectID);
    }

}


export class Note {
    public uri: vscode.Uri;  // used as identifier
    public project: Project;

    constructor(uri: vscode.Uri, project?: Project) {
        this.uri = uri;
        this.project = project || Project.unknownProject;
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
    private static _instance: NotesDB;

    public readonly notesStorageKey = "notesDB";
    public readonly projectsStorageKey = "projectsDB";

    private _globalState: vscode.Memento;

    private _onDBUpdated: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDBUpdated: vscode.Event<any> = this._onDBUpdated.event;

    private _notesDB = new Map<string, Note>();
    private _projectsDB = new Map<string, Project>();

    private constructor(globalState: vscode.Memento) {
        this._globalState = globalState;

        this.onDBUpdated(() => {
            console.log("DB note updated");
        });
    }

    public static getInstance(globalState: vscode.Memento) {
        if (!this._instance) {
            this._instance = new NotesDB(globalState);
        }

        return this._instance;
    }

    /**
     * Return all of the notes
     */
    public getAllNotes(): Iterable<Note> {
        return this._notesDB.values();
    }

    /**
     * Return all of the project
     */
    public *getAllProject(): Iterable<Project> {
        for (const item of this._projectsDB.values()) {
            yield item;
        }

        yield Project.unknownProject;
    }

    /**
     * Return all of the project which are being used in at least one note
     */
    public getAllUsedProject(): Iterable<Project> {
        return new Set(Array.from(this.getAllNotes()).map(note => note.project));
    }

    /**
     * Return a saved note based on its URI, if any
     * @param noteUri The note location uri
     * @returns The saved Note, if any
     */
    public getNoteFromUri(noteUri: vscode.Uri) {
        return this._notesDB.get(noteUri.toString());
    }

    /**
     * Return a project based on its URI, if any
     * @param noteUri The project location uri
     * @returns The project, if any
     */
    public getProjectFromUri(projectID: vscode.Uri) {
        return this._projectsDB.get(projectID.toString());
    }


    /**
     * Adds the given noteURI to the DB. Do not replace it if it already exists
     * @param noteUri The note location uri.
     */
    public addNoteToDBFromUri(noteUri: vscode.Uri) {
        if (this._notesDB.has(noteUri.toString())) {
            return;
        }

        this._notesDB.set(noteUri.toString(), new Note(noteUri));

        this._onDBUpdated.fire(undefined);
    }

    /**
     * Adds the given projectURI to the DB. Don't replace it if it already exists.
     * @param noteUri The note location uri.
     */
    public addProjectToDBFromUri(projectUri: vscode.Uri) {
        if (this._projectsDB.has(projectUri.toString())) {
            return;
        }

        const pathParts = projectUri.path.split('/').filter(Boolean);
        const fileName = pathParts[pathParts.length - 1];

        this._projectsDB.set(projectUri.toString(), new Project(projectUri.toString(), fileName));
        this._onDBUpdated.fire(undefined);
    }

    /**
     * Save or update the given note. Update based on note uri.
     * @param note
     */
    public saveNote(note: Note) {
        this._notesDB.set(note.uri.toString(), note);
    }

    /**
     * Save or update the given project. Update based on project ID.
     * @param note
     */
    public saveProject(project: Project) {
        this._projectsDB.set(project.projectID, project);
    }

    /**
     * Clear the database
     */
    public clearDB() {
        this._notesDB = new Map<string, Note>();
        this._projectsDB = new Map<string, Project>();
        this._onDBUpdated.fire(undefined);
    }

    /**
     * Adds the given noteURIs to the DB. Do not replace them if they already exist.
     * @param notesUris The note location uris.
     */
    public populateDBFromNoteUris(notesUris: Iterable<vscode.Uri>) {
        for (const note of notesUris) {
            this.addNoteToDBFromUri(note);
        }
    }

    /**
     * Adds the given noteURIs to the DB. Do not replace them if they already exist.
     * @param notesUris The note location uris.
     */
    public populateDBFromProjectUris(projectUris: Iterable<vscode.Uri>) {
        for (const uri of projectUris) {
            this.addProjectToDBFromUri(uri);
        }
    }

    /**
     * Persists the DB in the extension storage
     */
    public persistDB() {
        this._globalState.update(this.notesStorageKey, this._notesDB);
        this._globalState.update(this.projectsStorageKey, this._projectsDB);
    }

    /**
     * Load the DB from the persistant storage
     */
    public loadFromPersistantStorage() {
        this.clearDB();

        const persistantVal = this._globalState.get(this.notesStorageKey);

        if (persistantVal instanceof Map) {
            this._notesDB = this._globalState.get(this.notesStorageKey) as Map<string, Note> || new Map<string, Note>();
            this._projectsDB = this._globalState.get(this.projectsStorageKey) as Map<string, Project> || new Map<string, Project>();
            this._onDBUpdated.fire(undefined);
        }
    }
}
