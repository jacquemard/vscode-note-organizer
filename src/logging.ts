import * as vscode from "vscode";


export namespace Logging {
    export const channelInstance = vscode.window.createOutputChannel("Note Organizer");

    export function log(value: any) {
        channelInstance.appendLine(`[${new Date().toISOString()}] ${value}`);
    }
}
