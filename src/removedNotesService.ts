import * as vscode from "vscode";
import { Database } from "./db";

export default class RemovedNoteService {

    private static _instance: RemovedNoteService;
    private _db: Database;

    public static getInstance(db: Database) {
        if (!this._instance) {
            this._instance = new RemovedNoteService(db);
        }

        return this._instance;
    }

    private constructor(db: Database) {
        this._db = db;
    }


    public clearRemovedNotes() {
        this._db.removedNotes.clear();
    }

    public isNoteUriRemoved(uri: vscode.Uri) {
        return !!this._db.removedNotes.getAll().find(obj => obj.uri.toString() === uri.toString());
    }

    public addUriToRemovedNotes(uri: vscode.Uri) {
        if (this.isNoteUriRemoved(uri)) {
            return; // Nothing to do if uri already in removed notes
        }

        this._db.removedNotes.addOrUpdate({
            id: this._db.removedNotes.nextId,
            uri: uri,
        });
    }

    public removeUriFromRemovedNotes(uri: vscode.Uri) {
        const removedNote = this._db.removedNotes.getAll().find(obj => obj.uri.toString() === uri.toString());

        if (!removedNote) {
            return; // Nothing to do if uri already not present in removed notes
        }

        this._db.removedNotes.remove(removedNote);
    }

    public getAllRemovedNotesUris() {
        return this._db.removedNotes.getAll().map(obj => obj.uri);
    }

}
