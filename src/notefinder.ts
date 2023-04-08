import * as vscode from "vscode";

interface NoteFindDescription {
    rootPath: vscode.Uri;
    noteFilesPaths: Iterable<vscode.Uri>;
}

export default class NoteFinder {
    private readonly noteFilenameRegex = new RegExp(/^.*note.*(\.md|\.txt)$/gis);
    private readonly maxRecursionDepth = 20;

    private _paths: Iterable<vscode.Uri> = [];

    public set paths(paths: Iterable<vscode.Uri>) {
        this._paths = paths;
    }

    public get paths() {
        return this._paths;
    }

    public findNotesDocs() {

        const findInPath = async (filePath: vscode.Uri, depth: number) => {
            if (depth > this.maxRecursionDepth) {
                return [];
            }

            // Ensure path are constant
            if (filePath.path.endsWith('/')) {
                filePath = filePath.with({
                    path: filePath.path.slice(0, filePath.path.length - 1)
                });
            }

            const fileList: Array<vscode.Uri> = [];
            const fileStat = await vscode.workspace.fs.stat(filePath);

            if (fileStat.type === vscode.FileType.Directory) {
                // If the current path is a directory, recursively call findInPath for each subfile/directory
                const dirFiles = await vscode.workspace.fs.readDirectory(filePath);

                await Promise.all(dirFiles.map(async (subPathDesc) => {
                    const subFilePath = subPathDesc[0];
                    const subPathUri = vscode.Uri.joinPath(filePath, subFilePath);

                    fileList.push(...await findInPath(subPathUri, depth + 1));
                }));
            } else {
                // If the current path is a file, unknown or symlink, check its format.
                const filePathParts = filePath.path.split('/');
                const fileName = filePathParts[filePathParts.length - 1];

                if (this.noteFilenameRegex.test(fileName)) {
                    fileList.push(filePath);
                    console.log(`Found note file at ${filePath.fsPath}`);
                }
            }

            return fileList;
        };

        return Promise.all(Array.from(this._paths).map(async path => {
            const files = await findInPath(path, 0);
            return {
                rootPath: path,
                noteFilesPaths: files,
            } as NoteFindDescription;
        }));

    }
}
