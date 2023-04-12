import * as vscode from "vscode";
import { ProgressDesc } from "./utils";
import { Logging } from "./logging";

interface FoundNote {
    rootPath: vscode.Uri;
    noteFilesPaths: Array<vscode.Uri>;
}

/**
 * Scan directories looking for notes
 */
export default class NoteScanner {

    private readonly noteFilenameRegex;
    private readonly scanFolderRegex;
    private readonly maxRecursionDepth;
    private readonly maxDepthForLogging = 3;

    private _paths: Iterable<vscode.Uri> = [];

    public constructor(paths?: Iterable<vscode.Uri>) {
        this.paths = paths || [];

        this.noteFilenameRegex = new RegExp(vscode.workspace.getConfiguration("noteOrganizer").get('noteFileRegex', ".*"), "is");
        this.scanFolderRegex = new RegExp(vscode.workspace.getConfiguration("noteOrganizer").get('folderScanRegex', "^.*$"), "is");
        this.maxRecursionDepth = parseInt(vscode.workspace.getConfiguration("noteOrganizer").get('maxRecursionDepth', "15"));
    }

    public set paths(paths: Iterable<vscode.Uri>) {
        this._paths = paths;
    }

    public get paths() {
        return this._paths;
    }

    /**
     * Scan for note files
     * @param progressDesc Used to report the progress to vscode
     * @returns a promise with the found notes
     */
    public scanNotesDocs(progressDesc?: ProgressDesc) {
        const [progress, token] = progressDesc || [null, null];

        token?.onCancellationRequested(() => {
            Logging.log("User canceled searching notes");
        });

        const findInPath = async (filePath: vscode.Uri, depth: number) => {
            if (depth > this.maxRecursionDepth || token?.isCancellationRequested) {
                return [];
            }

            const fileList: Array<vscode.Uri> = [];
            try {
                const fileStat = await vscode.workspace.fs.stat(filePath);

                if (fileStat.type === vscode.FileType.Directory) {
                    if (depth <= this.maxDepthForLogging) {
                        Logging.log(`Scanning folder ${filePath.fsPath}`);
                    }

                    // If the current path is a directory, recursively call findInPath for each subfile/directory
                    const dirFiles = await vscode.workspace.fs.readDirectory(filePath);

                    await Promise.all(dirFiles.map(async ([subFilePath, type]) => {
                        const subPathUri = vscode.Uri.joinPath(filePath, subFilePath);

                        if (type === vscode.FileType.Directory && !this.scanFolderRegex.test(subFilePath)) {  // Check if this sub folder should be checked
                            Logging.log(`Skipping ${subPathUri} folder as it did not match the regex`);
                            return;
                        }

                        fileList.push(...await findInPath(subPathUri, depth + 1));
                    }));

                } else {
                    // If the current path is a file, unknown or symlink, check its format.
                    const filePathParts = filePath.path.split('/');
                    const fileName = filePathParts[filePathParts.length - 1];

                    if (this.isFilenameANote(fileName)) {
                        fileList.push(filePath);
                        Logging.log(`Found note file at ${filePath.fsPath}`);
                        progress?.report({ message: `Found note "${fileName}"` });
                    }
                }
            } catch (error) {
                Logging.log(`Scanning error: ${error}`);
            }

            return fileList;
        };

        progress?.report({
            message: `Scanning notes...`
        });

        return Promise.all(Array.from(this._paths).map(async path => {
            const files = await findInPath(path, 0);
            return {
                rootPath: path,
                noteFilesPaths: files,
            } as FoundNote;
        }));
    }

    public isFilenameANote(fileName: string): boolean {
        return this.noteFilenameRegex.test(fileName);
    }

    public isUriANote(uri: vscode.Uri): boolean {
        const pathParts = uri.path.split('/');
        return this.isFilenameANote(pathParts[pathParts.length - 1]);
    }
}
