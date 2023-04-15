import * as vscode from "vscode";

interface Serializer<In, Out> {
    serialize(object: In): Out,
    deserialize(object: Out): In,
}

// Entities -----
export interface IDEntity {
    id: number,
}

export interface ProjectEntity extends IDEntity {
    uri: vscode.Uri;
    name?: string;
}

export interface NoteEntity extends IDEntity {
    projectId?: number;
    uri: vscode.Uri;
}


// Serializers
type SerializedProject = {
    id: number,
    uri: string,
    name?: string,
};

class ProjectEntitySerializer implements Serializer<ProjectEntity, SerializedProject>{
    serialize(object: ProjectEntity): SerializedProject {
        return {
            id: object.id,
            uri: object.uri.toString(),
            name: object.name,
        };
    }
    deserialize(object: SerializedProject): ProjectEntity {
        return {
            id: object.id,
            uri: vscode.Uri.parse(object.uri),
            name: object.name,
        };
    }
}

type SerializedNote = {
    id: number,
    projectId?: number,
    uri: string,
};

class NoteEntitySerializer implements Serializer<NoteEntity, SerializedNote> {
    serialize(object: NoteEntity): SerializedNote {
        return {
            id: object.id,
            projectId: object.projectId,
            uri: object.uri.toString(),
        };
    }
    deserialize(object: SerializedNote): NoteEntity {
        return {
            id: object.id,
            projectId: object.projectId,
            uri: vscode.Uri.parse(object.uri),
        };
    }
}

// Database
class EntityManager<T extends IDEntity> {
    private _db: Set<T>;
    constructor(db: Set<T>) {
        this._db = db;
    }

    public getAll = () => Array.from(this._db.values());

    /**
     * Update or add the given object. Update if ID exists.
     * @param object
     */
    public addOrUpdate(object: T) {
        const existingObj = this.getById(object.id);
        if (existingObj) {
            this._db.delete(existingObj);
        }

        this._db.add(object);
        this._updatedEmitter.fire(undefined);
    };

    public addOrUpdateAll(objects: T[]) {
        objects.forEach(obj => {
            const existingObj = this.getById(obj.id);
            if (existingObj) {
                this._db.delete(existingObj);
            }

            this._db.add(obj);
        });
        this._updatedEmitter.fire(undefined);
    };

    public getById(id: number): T | undefined {
        return this.getAll().find(obj => obj.id === id);
    }

    public clear = () => {
        this._db.clear();
        this._updatedEmitter.fire(undefined);
    };

    public remove = (object: T) => {
        this._db.delete(object);
        this._updatedEmitter.fire(undefined);
    };

    // Events
    private _updatedEmitter: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
    public readonly updated: vscode.Event<undefined> = this._updatedEmitter.event;

}


export class Database {
    // Instance
    private static _instance: Database;
    private _globalState: vscode.Memento;

    // DBs
    private readonly _projectsDB = new Set<ProjectEntity>();
    private readonly _notesDB = new Set<NoteEntity>();

    private readonly _projectStorageKey = "projects";
    private readonly _notesStorageKey = "notes";

    private constructor(globalState: vscode.Memento) {
        this._globalState = globalState;

        // Subscribe to Entity managers for persistance
        this.projects.updated(() => this.persistProjects());
        this.notes.updated(() => this.persistNotes());
    }

    public static getInstance(globalState: vscode.Memento) {
        if (!this._instance) {
            this._instance = new Database(globalState);
        }

        return this._instance;
    }

    // DB managers
    public readonly projects = new EntityManager(this._projectsDB);
    public readonly notes = new EntityManager(this._notesDB);

    // Persistance

    /**
     * Persist the projects in globalState
     */
    public persistProjects() {
        const projectSerializer = new ProjectEntitySerializer();
        this._globalState.update(this._projectStorageKey, this.projects.getAll().map(obj => projectSerializer.serialize(obj)));
    }

    /**
     * Persist the notes in globalState
     */
    public persistNotes() {
        const noteSerializer = new NoteEntitySerializer();
        this._globalState.update(this._notesStorageKey, this.notes.getAll().map(obj => noteSerializer.serialize(obj)));
    }

    /**
     * Persist the full database in globalState
     */
    public persist() {
        this.persistProjects();
        this.persistNotes();
    }

    /**
     * Load the projects from the globalState
     */
    public loadProjects() {
        const projectSerializer = new ProjectEntitySerializer();

        this._projectsDB.clear();
        this._globalState.get(this._projectStorageKey, []).map(obj => projectSerializer.deserialize(obj)).forEach(proj => this._projectsDB.add(proj));
    }

    /**
     * Load the notes from the globalState
     */
    public loadNotes() {
        const notesSerializer = new NoteEntitySerializer();

        this._notesDB.clear();
        this._globalState.get(this._notesStorageKey, []).map(obj => notesSerializer.deserialize(obj)).forEach(note => this._notesDB.add(note));
    }

    /**
     * Load everything from the persistant globalState
     */
    public load() {
        this.loadProjects();
        this.loadNotes();
    }

    public clear() {
        this.notes.clear();
        this.projects.clear();
    }


}

// --- Models

class Project {
    id: number;
    uri: vscode.Uri;
    name?: string;

    constructor(id: number, uri: vscode.Uri, name?: string) {
        this.id = id;
        this.uri = uri;
        this.name = name;
    }
}

class Note {
    id: number;
    uri: vscode.Uri;
    project?: Project;

    constructor(id: number, uri: vscode.Uri, project?: Project) {
        this.id = id;
        this.uri = uri;
        this.project = project;
    }
}

// Testing
