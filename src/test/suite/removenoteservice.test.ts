import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import RemovedNoteService from '../../removedNotesService';
import { Database } from '../../db';


suite('Removed Note Service Test Suite', () => {
    let extensionContext: vscode.ExtensionContext;

    suiteSetup(async () => {
        // See https://stackoverflow.com/questions/62036883/how-to-get-extensioncontext-in-vscode-extension-unit-test
        // Trigger extension activation and grab the context as some tests depend on it
        await vscode.extensions.getExtension('RemiJacquemard.noteOrganizer')?.activate();
        extensionContext = (global as any).testExtensionContext;
    });

    test("Adding removed notes should work", () => {
        const service = RemovedNoteService.getInstance(Database.getInstance(extensionContext.globalState));

        service.clearRemovedNotes();

        // Test add
        service.addUriToRemovedNotes(vscode.Uri.file("c:/test.md"));
        service.addUriToRemovedNotes(vscode.Uri.file("c:/test2.md"));
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test.md")), true);
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test2.md")), true);
        assert.equal(service.getAllRemovedNotesUris().length, 2);
        assert.equal(service.getAllRemovedNotesUris()[0].toString(), vscode.Uri.file("C:/test.md").toString());
        assert.equal(service.getAllRemovedNotesUris()[1].toString(), vscode.Uri.file("C:/test2.md").toString());

        // Test remove
        service.removeUriFromRemovedNotes(vscode.Uri.file("c:/test.md"));
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test.md")), false);
        assert.equal(service.getAllRemovedNotesUris().length, 1);

        // Test clear
        service.addUriToRemovedNotes(vscode.Uri.file("c:/test.md"));
        service.clearRemovedNotes();
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test.md")), false);
        assert.equal(service.getAllRemovedNotesUris().length, 0);

    });

});
