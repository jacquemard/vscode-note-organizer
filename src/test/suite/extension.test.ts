import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as noteOrganizer from '../../extension';
import NotesDB, { Project } from '../../notesdb';
import { Note } from '../../notesdb';

function makeid(length: number) {
	let result = '';
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-.';
	const charactersLength = characters.length;
	let counter = 0;
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
		counter += 1;
	}
	return result;
}

suite('Store Test Suite', () => {

	let extensionContext: vscode.ExtensionContext;
	suiteSetup(async () => {
		// See https://stackoverflow.com/questions/62036883/how-to-get-extensioncontext-in-vscode-extension-unit-test
		// Trigger extension activation and grab the context as some tests depend on it
		await vscode.extensions.getExtension('RemiJacquemard.noteOrganizer')?.activate();
		extensionContext = (global as any).testExtensionContext;

		const notesDB = NotesDB.getInstance(extensionContext.globalState);
		notesDB.clearDB();
		notesDB.persistDB();
	});

	test("Store should support big load", () => {
		const notesDB = NotesDB.getInstance(extensionContext.globalState);

		for (let i = 0; i < 1000; i++) {
			notesDB.saveProject(new Project(`${makeid(5)}/${makeid(5)}/${makeid(10)}/${makeid(10)}/${makeid(10)}/${makeid(10)}/${makeid(10)}`));
		}

		const proj = notesDB.saveProject(new Project("MyTestProj", "My test proj"));

		for (let i = 0; i < 1000; i++) {
			notesDB.saveNote(new Note(vscode.Uri.file(`${makeid(5)}/${makeid(5)}/${makeid(10)}/${makeid(10)}/${makeid(10)}/${makeid(10)}/${makeid(10)}`)));
			notesDB.saveNote(new Note(vscode.Uri.file(`${makeid(5)}/${makeid(5)}/${makeid(10)}/${makeid(10)}/${makeid(10)}/${makeid(10)}/${makeid(10)}`), proj));
			notesDB.persistDB();
		}

		notesDB.persistDB();
		notesDB.clearDB();

		notesDB.loadFromPersistantStorage();

		assert.equal(Array.from(notesDB.getAllProject()).length, 1001);
		assert.equal(Array.from(notesDB.getAllNotes()).length, 2000);
	});

});
