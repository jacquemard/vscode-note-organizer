import * as vscode from "vscode";
import { ProgressDesc, getFileName, getParentUri } from "./utils";
import { Logging } from "./logging";

export enum FindingType {
    note,
    project
}

export interface Finding {
    path: vscode.Uri;
    type: FindingType
};


export default class Scanner {

    public noteFilenameRegex;
    public scanFolderRegex;
    public projectInnerFileRegex;
    public maxRecursionDepth;
    public maxConcurrency;
    public maxDepthForLogging = 3;

    private _activeConcurrency = 0;

    public constructor() {
        const conf = vscode.workspace.getConfiguration("noteOrganizer");

        this.noteFilenameRegex = new RegExp(conf.get<string>('noteFileRegex', ".*"), "is");
        this.scanFolderRegex = new RegExp(conf.get<string>('folderScanRegex', "^.*$"), "is");
        this.projectInnerFileRegex = new RegExp(vscode.workspace.getConfiguration("noteOrganizer").get('projectInnerFileRegex', "^.vscode$"), "is");
        this.maxRecursionDepth = conf.get<number>('maxRecursionDepth', 15);
        this.maxConcurrency = conf.get<number>('scanConcurrency', 20);
    }

    public async scan(rootPath: vscode.Uri, progressDesc?: ProgressDesc): Promise<Iterable<Finding>> {
        const [progress, token] = progressDesc || [undefined, undefined];

        token?.onCancellationRequested(() => {
            Logging.log("User canceled searching notes");
        });

        const findings: Finding[] = [];

        progress?.report({
            message: `Scanning notes...`
        });

        // Walk the given path
        await this.walk(rootPath, (path, fileType) => {
            if (this.isUriInnerFileForProject(path)) {
                // We have find a project (.vscode folder), the project is the parent one
                findings.push({
                    type: FindingType.project,
                    path: getParentUri(path)
                });

                Logging.log(`Found project at ${getParentUri(path).fsPath}`);
                progress?.report({ message: `Found project "${getParentUri(path).fsPath}"` });
            } else if (fileType === vscode.FileType.File && this.isUriANote(path)) {
                // We have find a note
                findings.push({
                    type: FindingType.note,
                    path: path,
                });

                Logging.log(`Found note file at ${path.fsPath}`);
                progress?.report({ message: `Found note "${getFileName(path)}"` });
            }
        }, token);

        return findings;
    }

    private async walk(folder: vscode.Uri, onFolderWalk: (path: vscode.Uri, fileType: vscode.FileType) => void, cancellationToken?: vscode.CancellationToken, depth = 0) {
        // Walk the given folder. Folder should not be a file.

        if (cancellationToken?.isCancellationRequested) {
            return;
        }

        if (depth > this.maxRecursionDepth) {
            return;
        }

        if (!this.shouldScanFolder(folder)) {
            Logging.log(`Skipping ${folder} folder as it did not match the regex`);
            return;
        }

        if (depth <= this.maxDepthForLogging) {
            Logging.log(`Scanning folder ${folder.fsPath}`);
        }

        // Signal this directory
        onFolderWalk(folder, vscode.FileType.Directory);

        // Check folder content + call walk recursively for subfolder

        const checkSubFiles = async ([subFilePath, type]: [string, vscode.FileType]) => {
            const subPathUri = vscode.Uri.joinPath(folder, subFilePath);

            // Walk sub directory
            if (type === vscode.FileType.Directory) {
                await this.walk(subPathUri, onFolderWalk, cancellationToken, depth + 1);
            } else {
                // Let walk this subfile. Do not walk directory here
                onFolderWalk(subPathUri, type);
            }
        };

        try {
            const dirFiles = await vscode.workspace.fs.readDirectory(folder);

            if (this._activeConcurrency >= this.maxConcurrency) {
                for (let [subFilePath, type] of dirFiles) {
                    await checkSubFiles([subFilePath, type]);
                }
            } else {
                await Promise.all(dirFiles.map(async ([subFilePath, type]) => {
                    this._activeConcurrency++;
                    await checkSubFiles([subFilePath, type]);
                    this._activeConcurrency--;
                }));
            }
        } catch (error) {
            Logging.log(`Scanning error: ${error}`);
        }
    }

    public isUriInnerFileForProject(uri: vscode.Uri) {
        return this.projectInnerFileRegex.test(getFileName(uri));
    }

    public isUriANote(uri: vscode.Uri): boolean {
        return this.noteFilenameRegex.test(getFileName(uri));
    }

    public shouldScanFolder(uri: vscode.Uri) {
        return this.scanFolderRegex.test(getFileName(uri));
    }
}
