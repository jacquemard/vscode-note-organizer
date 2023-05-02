import * as vscode from "vscode";

import { Database } from "../db";
import { Project } from "./noteservice";


export default class DraftFolderService {
    private static _instance: DraftFolderService;
    private _context: vscode.ExtensionContext;

    public static getInstance(context: vscode.ExtensionContext) {
        if (!this._instance) {
            this._instance = new DraftFolderService(context);
        }

        return this._instance;
    }

    private constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public getDraftFolder(): vscode.Uri {
        const conf = vscode.workspace.getConfiguration("noteOrganizer");

        let draftFolderStr = conf.get<string>('draftFolder');

        let draftFolder;
        if (draftFolderStr) {
            draftFolder = vscode.Uri.file(draftFolderStr);
        } else {
            draftFolder = vscode.Uri.joinPath(this._context.globalStorageUri, "drafts");

            // Ensure the folder exists
            vscode.workspace.fs.createDirectory(draftFolder);
        }

        return draftFolder;
    }
}
