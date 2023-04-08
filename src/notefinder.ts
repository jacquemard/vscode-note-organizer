import * as vscode from "vscode" ;

class NoteFinder {
    private _paths: Iterable<vscode.Uri> = [];

    public set paths(paths: Iterable<vscode.Uri>) {
        this._paths = paths;
    }

    public get paths() {
        return this._paths;
    }

    public findNotesDocs() {
        const uri = vscode.Uri.parse("~");
        
    }

}
