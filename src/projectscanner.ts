import * as vscode from "vscode";
import { ProgressDesc } from "./utils";
import { dir } from "console";
import { Logging } from "./logging";

interface FoundProject {
    rootPath: vscode.Uri;
    projectPath: vscode.Uri;
}

/**
 * From given file paths, looks for projects paths based on .vscode folder
 */
export default class ProjectScanner {

    private readonly projectInnerFileRegex;

    private _paths: Iterable<vscode.Uri> = [];

    public constructor(paths?: Iterable<vscode.Uri>) {
        this.paths = paths || [];

        this.projectInnerFileRegex = new RegExp(vscode.workspace.getConfiguration("noteOrganizer").get('projectInnerFileRegex', "^.vscode$"), "gis");
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
    public searchProjects(progressDesc?: ProgressDesc) {
        const [progress, token] = progressDesc || [null, null];

        token?.onCancellationRequested(() => {
            Logging.log("User canceled searching projects");
        });

        const findForPath = async (fileOrFolderPath: vscode.Uri): Promise<vscode.Uri | null> => {
            if (token?.isCancellationRequested) {
                return null;
            }

            try {

                const fileStat = await vscode.workspace.fs.stat(fileOrFolderPath);

                if (fileStat.type === vscode.FileType.Directory) {
                    // If the current path is a directory, check first if it is a project

                    const dirFiles = await vscode.workspace.fs.readDirectory(fileOrFolderPath);

                    // If current directory contains files or folders matching the regex (founding .vscode file), it's a project folder
                    if (dirFiles.filter(([filename, type]) => this.projectInnerFileRegex.test(filename)).length) {
                        Logging.log(`Found project at ${fileOrFolderPath.fsPath}`);
                        progress?.report({ message: `Found project "${fileOrFolderPath.fsPath}"` });
                        return fileOrFolderPath;
                    }
                }

                const pathParts = fileOrFolderPath.path.split('/');
                if (pathParts.filter(Boolean).length <= 1) {
                    Logging.log(`No project found at ${fileOrFolderPath}`);
                    // No more parent
                    return null;
                }

                // If it is not a project folder, check the parent
                const parentParts = pathParts.slice(0, pathParts.length - 1);
                return findForPath(fileOrFolderPath.with({
                    path: parentParts.join("/"),
                }));
            } catch (error) {
                Logging.log(`Scanning error: ${error}`);
                return null;
            }
        };

        progress?.report({
            message: `Searching projects...`
        });

        return Promise.all(Array.from(this._paths).map(async path => {
            const project = await findForPath(path);

            return {
                rootPath: path,
                projectPath: project,
            } as FoundProject;
        }));
    }
}
