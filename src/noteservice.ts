import * as vscode from "vscode";
import { Database, EntityManager, NoteEntity, ProjectEntity } from "./db";

// --- Models

export class Project {
    private _id: number;
    public get id(): number {
        return this._id;
    }
    public set id(value: number) {
        this._id = value;
        Project._onUpdated.fire(this);
    }

    private _uri: vscode.Uri;
    public get uri(): vscode.Uri {
        return this._uri;
    }
    public set uri(value: vscode.Uri) {
        this._uri = value;
        Project._onUpdated.fire(this);
    }

    private _name?: string | undefined;
    public get name(): string | undefined {
        return this._name;
    }
    public set name(value: string | undefined) {
        this._name = value;
        Project._onUpdated.fire(this);
    }

    // TODO: event listener (maybe static) + setter and getter ?, listen in Service ?

    constructor(id: number, uri: vscode.Uri, name?: string) {
        this._id = id;
        this._uri = uri;
        this._name = name;

        Project._onUpdated.fire(this);
    }

    private static _onUpdated: vscode.EventEmitter<Project> = new vscode.EventEmitter<Project>();
    public static readonly onUpdated: vscode.Event<Project> = this._onUpdated.event;
}

export class Note {
    private _id: number;
    public get id(): number {
        return this._id;
    }
    public set id(value: number) {
        this._id = value;
        Note._onUpdated.fire(this);
    }
    private _uri: vscode.Uri;
    public get uri(): vscode.Uri {
        return this._uri;
    }
    public set uri(value: vscode.Uri) {
        this._uri = value;
        Note._onUpdated.fire(this);
    }
    private _project?: Project | undefined;
    public get project(): Project | undefined {
        return this._project;
    }
    public set project(value: Project | undefined) {
        this._project = value;
        Note._onUpdated.fire(this);
    }

    constructor(id: number, uri: vscode.Uri, project?: Project) {
        this._id = id;
        this._uri = uri;
        this._project = project;

        Note._onUpdated.fire(this);
    }

    private static _onUpdated: vscode.EventEmitter<Note> = new vscode.EventEmitter<Note>();
    public static readonly onUpdated: vscode.Event<Note> = this._onUpdated.event;
}

interface EntityModel<E, M> {
    entityToModel(entity: E): M;
    modelToEntity(model: M): E;
}

class ProjectEntityModel implements EntityModel<ProjectEntity, Project> {
    private _service: NoteService;

    constructor(service: NoteService) {
        this._service = service;
    }

    entityToModel(entity: ProjectEntity): Project {
        return new Project(entity.id, entity.uri, entity.name);
    }
    modelToEntity(model: Project): ProjectEntity {
        return {
            id: model.id,
            uri: model.uri,
            name: model.name,
        };
    }
}

class NoteEntityModel implements EntityModel<NoteEntity, Note> {
    private _service: NoteService;

    constructor(service: NoteService) {
        this._service = service;
    }

    entityToModel(entity: NoteEntity): Note {
        // Needs service projects to be loaded. Finds the project
        const proj = this._service.getAllProjects().find(proj => proj.id === entity.projectId);

        return new Note(entity.id, entity.uri, proj);
    }
    modelToEntity(model: Note): NoteEntity {
        return {
            id: model.id,
            uri: model.uri,
            projectId: model.project?.id,
        };
    }
}

export class NoteService {
    private static _instance: NoteService;
    private _db: Database;

    private _onUpdated: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
    readonly onUpdated: vscode.Event<undefined> = this._onUpdated.event;

    private projects!: Set<Project>;
    private notes!: Set<Note>;

    public static getInstance(db: Database) {
        if (!this._instance) {
            this._instance = new NoteService(db);
        }

        return this._instance;
    }

    private constructor(db: Database) {
        this._db = db;
        this._loadFromDB();

        // Listen for change of a project and persist it in DB
        Project.onUpdated((proj) => {
            const projEntity = new ProjectEntityModel(this).modelToEntity(proj);
            this._db.projects.addOrUpdate(projEntity);

            this._onUpdated.fire(undefined);
        });
        Note.onUpdated((note) => {
            const noteEntity = new NoteEntityModel(this).modelToEntity(note);
            this._db.notes.addOrUpdate(noteEntity);

            this._onUpdated.fire(undefined);
        });
    }

    private _loadFromDB() {
        this.projects = new Set(this._db.projects.getAll().map(projectEntity => new ProjectEntityModel(this).entityToModel(projectEntity)));
        this.notes = new Set(this._db.notes.getAll().map(noteEntity => new NoteEntityModel(this).entityToModel(noteEntity)));
    }

    public getAllProjects() {
        return Array.from(this.projects.values());
    }

    public getAllNotes() {
        return Array.from(this.notes.values());
    }

    public newProject(uri: vscode.Uri, name?: string) {
        // Find the last id
        const lastIndex = this.getAllProjects().map(proj => proj.id).sort((a, b) => b - a)[0] || 0;

        const proj = new Project(lastIndex + 1, uri, name);
        this.projects.add(proj);

        // Event triggered in project constructor

        return proj;
    }

    public newNote(uri: vscode.Uri, project?: Project) {
        // Find the last id
        const lastIndex = this.getAllNotes().map(note => note.id).sort((a, b) => b - a)[0] || 0;

        const note = new Note(lastIndex + 1, uri, project);
        this.notes.add(note);

        // Event triggered in note constructor

        return note;
    }

    public removeProject(project: Project) {
        this.projects.delete(project);
        this._db.projects.remove(new ProjectEntityModel(this).modelToEntity(project));

        this._onUpdated.fire(undefined);
    }

    public removeNote(note: Note) {
        this.notes.delete(note);
        this._db.notes.remove(new NoteEntityModel(this).modelToEntity(note));

        this._onUpdated.fire(undefined);
    }

    public clearProjects() {
        this.projects.clear();
        this._db.projects.clear();

        this._onUpdated.fire(undefined);
    }

    public clearNotes() {
        this.notes.clear();
        this._db.notes.clear();

        this._onUpdated.fire(undefined);
    }

    clear() {
        this.clearNotes();
        this.clearProjects();
    }


}
