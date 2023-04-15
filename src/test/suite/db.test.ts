import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Database, NoteEntity, ProjectEntity } from '../../db';


suite('DB Test Suite', () => {
    let extensionContext: vscode.ExtensionContext;

    suiteSetup(async () => {
        // See https://stackoverflow.com/questions/62036883/how-to-get-extensioncontext-in-vscode-extension-unit-test
        // Trigger extension activation and grab the context as some tests depend on it
        await vscode.extensions.getExtension('RemiJacquemard.noteOrganizer')?.activate();
        extensionContext = (global as any).testExtensionContext;
    });

    test("Store basic functions should work", () => {
        const notesDB = Database.getInstance(extensionContext.globalState);

        const projs: ProjectEntity[] = [{
            id: 1,
            uri: vscode.Uri.file("c:/"),
            name: "My name",
        }];

        const notes: NoteEntity[] = [{
            id: 1,
            uri: vscode.Uri.file("c:/test.md")
        }, {
            id: 2,
            projectId: 1,
            uri: vscode.Uri.file("c:/test2.md"),
        }];

        // Load everything in the database
        notesDB.notes.addAll(notes);
        notesDB.projects.addAll(projs);

        // Should have been persisted, lets load from storage to test that
        notesDB.load();

        assert.equal(notesDB.notes.getAll().length, 2);
        assert.equal(notesDB.projects.getAll().length, 1);

        // Let ensure everything's right
        assert.equal(notesDB.notes.getAll()[0].id, 1);
        assert.equal(notesDB.notes.getAll()[0].uri.fsPath, "c:\\test.md");
        assert.equal(notesDB.notes.getAll()[0].projectId, undefined);

        assert.equal(notesDB.projects.getAll()[0].id, 1);
        assert.equal(notesDB.projects.getAll()[0].uri.fsPath, "c:\\");

        assert.equal(notesDB.notes.getAll()[1].id, 2);
        assert.equal(notesDB.notes.getAll()[1].uri.fsPath, "c:\\test2.md");
        assert.equal(notesDB.notes.getAll()[1].projectId, 1);

    });

});
