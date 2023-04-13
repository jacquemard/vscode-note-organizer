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
    public getAllProject(): Iterable<Project> {
        return this._projectsDB.values();
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
     * Return a project based on its URI, if any
     * @param noteUri The project location uri
     * @returns The project, if any
     */
    public getProjectFromIdentifier(projectID: string) {
        if (projectID === Project.unknownProject.projectID) {
            return Project.unknownProject;
        }

        return this._projectsDB.get(projectID);
    }


    /**
     * Adds the given noteURI to the DB. Do not replace it if it already exists
     * @param noteUri The note location uri.
     */
    public addNoteToDBFromUri(noteUri: vscode.Uri) {
        const existingNote = this._notesDB.get(noteUri.toString());

        if (existingNote) {
            return existingNote;
        }

        const newNote = new Note(noteUri);
        this._notesDB.set(noteUri.toString(), newNote);
        this._onDBUpdated.fire(undefined);

        return newNote;
    }

    /**
     * Adds the given projectURI to the DB. Don't replace it if it already exists.
     * @param noteUri The note location uri.
     */
    public addProjectToDBFromUri(projectUri: vscode.Uri) {
        const existingProject = this._projectsDB.get(projectUri.toString());

        if (existingProject) {
            return existingProject;
        }

        const pathParts = projectUri.path.split('/').filter(Boolean);
        const fileName = pathParts[pathParts.length - 1];
        const newProject = new Project(projectUri.toString(), fileName);

        this._projectsDB.set(projectUri.toString(), newProject);
        this._onDBUpdated.fire(undefined);

        return newProject;
    }

    /**
     * Save or update the given note. Update based on note uri.
     * @param note
     */
    public saveNote(note: Note) {
        this._notesDB.set(note.uri.toString(), note);
        this._onDBUpdated.fire(undefined);

        return note;
    }

    /**
     * Save or update the given project. Update based on project ID.
     * @param note
     */
    public saveProject(project: Project) {
        this._projectsDB.set(project.projectID, project);
        this._onDBUpdated.fire(undefined);

        return project;
    }

    public deleteProjectByID(projectID: string) {
        this._projectsDB.delete(projectID);
        this._onDBUpdated.fire(undefined);
    }

    public deleteNoteByURI(noteURI: vscode.Uri) {
        this._notesDB.delete(noteURI.toString());
        this._onDBUpdated.fire(undefined);
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
        this._globalState.update(this.notesStorageKey, this.serializeNotes(this._notesDB));
        this._globalState.update(this.projectsStorageKey, this.serializeProjects(this._projectsDB));
    }

    /**
     * Load the DB from the persistant storage
     */
    public loadFromPersistantStorage() {
        this.clearDB();

        // Load projects
        const projectVal = this._globalState.get(this.projectsStorageKey, null);
        if (!projectVal) {
            return;
        }
        this._projectsDB = this.deserializeProject(projectVal);

        // Load notes
        const noteVal = this._globalState.get(this.notesStorageKey, null);
        if (!noteVal) {
            return;
        }
        this._notesDB = this.deserializeNotes(noteVal);

        this._onDBUpdated.fire(undefined);
    }

    public triggerChanged() {
        this._onDBUpdated.fire(undefined);
    }

    private serializeMap(val: Map<any, any>) {
        return Array.from(val.entries());
    }

    private deserializeToMap(val: Array<[any, any]>) {
        return new Map(val);
    }

    private serializeNotes(val: Map<string, Note>): Array<[string, any]> {
        return Array.from(this._notesDB.entries()).map(([key, note]) => {
            return [key, {
                project: note.project.projectID,
                uri: note.uri.toString()
            }];
        });
    }

    private serializeProjects(val: Map<string, Project>): Array<[string, any]> {
        return this.serializeMap(val);
    }

    private deserializeProject(values: Array<[string, any]>): Map<string, Project> {
        return new Map(values.map(([key, value]) => {
            return [key, new Project(value.projectID, value.projectName)];
        }));
    };

    private deserializeNotes(values: Array<[string, any]>): Map<string, Note> {
        return new Map(values.map(([key, value]) => {
            return [key, new Note(vscode.Uri.parse(value.uri), this.getProjectFromIdentifier(value.project))];
        }));
    };
}

