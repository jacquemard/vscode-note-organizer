import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Database } from '../../db';
import { NoteService } from '../../noteservice';


suite('Note Service Test Suite', () => {
    let extensionContext: vscode.ExtensionContext;

    suiteSetup(async () => {
        // See https://stackoverflow.com/questions/62036883/how-to-get-extensioncontext-in-vscode-extension-unit-test
        // Trigger extension activation and grab the context as some tests depend on it
        await vscode.extensions.getExtension('RemiJacquemard.noteOrganizer')?.activate();
        extensionContext = (global as any).testExtensionContext;
    });

    test("Adding note and projects should work", () => {
        const db = Database.getInstance(extensionContext.globalState);
        const notesService = NoteService.getInstance(db);
        notesService.clear();

        // Testing projects
        const proj1 = notesService.newProject(vscode.Uri.file("c:/"));
        const proj2 = notesService.newProject(vscode.Uri.file("c:/sub"), "myname");
        const proj3 = notesService.newProject(vscode.Uri.file("c:/"));

        assert.ok(proj1);
        assert.ok(proj2);
        assert.ok(proj3);

        assert.equal(proj1.id, 1);
        assert.equal(proj1.uri.path, "/c:/");
        assert.equal(proj1.name, undefined);

        assert.equal(proj2.id, 2);
        assert.equal(proj2.uri.path, "/c:/sub");
        assert.equal(proj2.name, "myname");

        assert.equal(proj3.id, 3);

        // Testing notes
        const note1 = notesService.newNote(vscode.Uri.file("c:/note.md"));
        const note2 = notesService.newNote(vscode.Uri.file("c:/note2.md"), proj1);

        assert.ok(note1);
        assert.ok(note2);

        assert.equal(note1.id, 1);
        assert.equal(note1.uri.path, "/c:/note.md");
        assert.equal(note1.project, undefined);

        assert.equal(note2.id, 2);
        assert.equal(note2.uri.path, "/c:/note2.md");
        assert.equal(note2.project, proj1);

        // Testings service content
        assert.equal(notesService.getAllProjects().length, 3);
        assert.equal(notesService.getAllNotes().length, 2);
    });

    test("Adding note and project should have an effect on DB", () => {
        const db = Database.getInstance(extensionContext.globalState);
        db.clear();

        const notesService = NoteService.getInstance(db);

        const proj1 = notesService.newProject(vscode.Uri.file("c:/"));
        const proj2 = notesService.newProject(vscode.Uri.file("c:/sub"), "myname");

        const note1 = notesService.newNote(vscode.Uri.file("c:/note.md"));
        const note2 = notesService.newNote(vscode.Uri.file("c:/note2.md"), proj1);

        // Let reload from persistant storage
        db.load();

        assert.equal(db.projects.getAll().length, 2);
        assert.equal(db.notes.getAll().length, 2);
    });

});
