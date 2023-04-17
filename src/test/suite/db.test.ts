import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Database, NoteEntity, ProjectEntity, RemovedNotesEntity } from '../../db';


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
        notesDB.clear();

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
        notesDB.notes.addOrUpdateAll(notes);
        notesDB.projects.addOrUpdateAll(projs);

        // Should have been persisted, lets load from storage to test that
        notesDB.load();

        assert.equal(notesDB.notes.getAll().length, 2);
        assert.equal(notesDB.projects.getAll().length, 1);

        // Let ensure everything's right
        assert.equal(notesDB.notes.getAll()[0].id, 1);
        assert.equal(notesDB.notes.getAll()[0].uri.path, "/c:/test.md");
        assert.equal(notesDB.notes.getAll()[0].projectId, undefined);

        assert.equal(notesDB.projects.getAll()[0].id, 1);
        assert.equal(notesDB.projects.getAll()[0].uri.path, "/c:/");

        assert.equal(notesDB.notes.getAll()[1].id, 2);
        assert.equal(notesDB.notes.getAll()[1].uri.path, "/c:/test2.md");
        assert.equal(notesDB.notes.getAll()[1].projectId, 1);

    });

    test("Store update should work", () => {
        const notesDB = Database.getInstance(extensionContext.globalState);
        notesDB.clear();

        const proj: ProjectEntity = {
            id: 1,
            uri: vscode.Uri.file("c:/"),
            name: "My name",
        };

        const note: NoteEntity = {
            id: 1,
            uri: vscode.Uri.file("c:/test.md")
        };

        // Load everything in the database
        notesDB.notes.addOrUpdate(note);
        notesDB.projects.addOrUpdate(proj);

        // Should have been persisted, lets load from storage to test that
        notesDB.load();

        assert.equal(notesDB.notes.getAll().length, 1);
        assert.equal(notesDB.projects.getAll().length, 1);

        // Let update things by id
        notesDB.notes.addOrUpdate({
            id: 1,
            uri: vscode.Uri.file("c:/testnew.md"),
        });
        notesDB.projects.addOrUpdate({
            id: 1,
            name: "new Name",
            uri: vscode.Uri.file("c:/subfolder"),
        });

        // Check db content
        assert.equal(notesDB.notes.getAll().length, 1);
        assert.equal(notesDB.projects.getAll().length, 1);

        assert.equal(notesDB.notes.getAll()[0].uri.path, "/c:/testnew.md");

        assert.equal(notesDB.projects.getAll()[0].uri.path, "/c:/subfolder");
        assert.equal(notesDB.projects.getAll()[0].name, "new Name");

        // Test remove
        notesDB.notes.remove(note);
        notesDB.projects.remove(proj);

        notesDB.load();

        assert.equal(notesDB.notes.getAll().length, 0);
        assert.equal(notesDB.projects.getAll().length, 0);
    });

    test("Removed notes db should work", () => {
        const notesDB = Database.getInstance(extensionContext.globalState);
        notesDB.clear();

        const removedNotes: RemovedNotesEntity[] = [{
            id: 1,
            uri: vscode.Uri.file("c:/test.md"),
        }, {
            id: 2,
            uri: vscode.Uri.file("c:/test2.md"),
        }];

        // Load everything in the database
        notesDB.removedNotes.addOrUpdateAll(removedNotes);

        // Should have been persisted, lets load from storage to test that
        notesDB.load();

        assert.equal(notesDB.removedNotes.getAll().length, 2);

        // Let ensure everything's right
        assert.equal(notesDB.removedNotes.getAll()[0].id, 1);
        assert.equal(notesDB.removedNotes.getAll()[0].uri.path, "/c:/test.md");

        assert.equal(notesDB.removedNotes.getAll()[1].id, 2);
        assert.equal(notesDB.removedNotes.getAll()[1].uri.path, "/c:/test2.md");


    });

});
