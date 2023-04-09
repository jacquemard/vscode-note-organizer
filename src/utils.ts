import * as vscode from "vscode";

export type ProgressDesc = [progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken];
export type NonCancelableProgressDesc = [progress: vscode.Progress<{ message?: string; increment?: number }>, token: null];
