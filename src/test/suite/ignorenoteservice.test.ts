import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import IgnoreNoteService from '../../ignoreNotesService';
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
        const service = IgnoreNoteService.getInstance(Database.getInstance(extensionContext.globalState));

        service.clearIgnoreNotes();

        // Test add
        service.addUriToIgnoreNotes(vscode.Uri.file("c:/test.md"));
        service.addUriToIgnoreNotes(vscode.Uri.file("c:/test2.md"));
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test.md")), true);
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test2.md")), true);
        assert.equal(service.getAllIgnoreNotesUris().length, 2);
        assert.equal(service.getAllIgnoreNotesUris()[0].toString(), vscode.Uri.file("C:/test.md").toString());
        assert.equal(service.getAllIgnoreNotesUris()[1].toString(), vscode.Uri.file("C:/test2.md").toString());

        // Test remove
        service.removeUriFromIgnoreNotes(vscode.Uri.file("c:/test.md"));
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test.md")), false);
        assert.equal(service.getAllIgnoreNotesUris().length, 1);

        // Test clear
        service.addUriToIgnoreNotes(vscode.Uri.file("c:/test.md"));
        service.clearIgnoreNotes();
        assert.equal(service.isNoteUriRemoved(vscode.Uri.file("C:/test.md")), false);
        assert.equal(service.getAllIgnoreNotesUris().length, 0);

    });

});
