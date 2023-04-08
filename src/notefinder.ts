import * as vscode from "vscode";
import * as fsPromise from "fs/promises";
import * as path from "path";
import { strict } from "assert";


export default class NoteFinder {
    private readonly _fileNameRegex = new RegExp(/^.*note.*(\.md|\.txt)$/gis);

    private _paths: Iterable<vscode.Uri> = [];

    public set paths(paths: Iterable<vscode.Uri>) {
        this._paths = paths;
    }

    public get paths() {
        return this._paths;
    }

    public findNotesDocs() {
        // TODO: limit

        const findInPath = async (filePath: vscode.Uri) => {
            const fileList: Array<vscode.Uri> = [];
            const fileStat = await fsPromise.lstat(filePath.fsPath);

            if (fileStat.isDirectory()) {
                // If the current path is a directory, recursively call findInPath for each subfile/directory
                const dirFiles = await fsPromise.readdir(filePath.fsPath);

                await Promise.all(dirFiles.map(async (subFilePath) => {
                    const subPathUri = vscode.Uri.parse(`${filePath.scheme}://${filePath.path}/${subFilePath}`, true);
                    fileList.push(...await findInPath(subPathUri));
                }));
            } else {
                // If the current path is a file, check its format.
                const filePathParts = filePath.path.split('/');
                const fileName = filePathParts[filePathParts.length - 1];

                if (this._fileNameRegex.test(fileName)) {
                    fileList.push(filePath);
                    console.log(`Found file at ${filePath.fsPath}`);
                }
            }

            return fileList;
        };

        Array.from(this._paths).forEach(async path => {
            //const files = await fsPromise.readdir(path.fsPath);
            const files = await findInPath(path);
            console.log("All found files: ");
            console.log(files);
        });

    }
}
