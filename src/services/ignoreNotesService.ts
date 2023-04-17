import * as vscode from "vscode";
import { Database } from "../db";

export default class IgnoreNoteService {

    private static _instance: IgnoreNoteService;
    private _db: Database;

    public static getInstance(db: Database) {
        if (!this._instance) {
            this._instance = new IgnoreNoteService(db);
        }

        return this._instance;
    }

    private constructor(db: Database) {
        this._db = db;
    }


    public clearIgnoreNotes() {
        this._db.ignoreNotes.clear();
    }

    public isNoteUriRemoved(uri: vscode.Uri) {
        return !!this._db.ignoreNotes.getAll().find(obj => obj.uri.toString() === uri.toString());
    }

    public addUriToIgnoreNotes(uri: vscode.Uri) {
        if (this.isNoteUriRemoved(uri)) {
            return; // Nothing to do if uri already in removed notes
        }

        this._db.ignoreNotes.addOrUpdate({
            id: this._db.ignoreNotes.nextId,
            uri: uri,
        });
    }

    public removeUriFromIgnoreNotes(uri: vscode.Uri) {
        const ignoreNote = this._db.ignoreNotes.getAll().find(obj => obj.uri.toString() === uri.toString());

        if (!ignoreNote) {
            return; // Nothing to do if uri already not present in removed notes
        }

        this._db.ignoreNotes.remove(ignoreNote);
    }

    public getAllIgnoreNotesUris() {
        return this._db.ignoreNotes.getAll().map(obj => obj.uri);
    }

}
