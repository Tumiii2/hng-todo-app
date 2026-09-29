const express = require('express');

const allowedFields = new Set(['title', 'content']);

function validateNoteInput(body, { create = false, replace = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const fields = Object.keys(body);
  if (fields.length === 0) {
    return { error: 'Request body must include note fields.' };
  }

  if (fields.some((field) => !allowedFields.has(field))) {
    return { error: 'Request body contains an unsupported field.' };
  }

  if (create && ['title', 'content'].some((field) => !Object.hasOwn(body, field))) {
    return { error: 'title and content are required.' };
  }

  if (replace && ['title', 'content'].some((field) => !Object.hasOwn(body, field))) {
    return { error: 'PUT requires title and content.' };
  }

  const note = {};

  if (Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return { error: 'title must be a non-empty string.' };
    }
    note.title = body.title.trim();
  }

  if (Object.hasOwn(body, 'content')) {
    if (typeof body.content !== 'string') {
      return { error: 'content must be a string.' };
    }
    note.content = body.content;
  }

  return { note };
}

function parseNoteId(value) {
  const noteId = Number(value);
  return Number.isSafeInteger(noteId) && noteId > 0 ? noteId : null;
}

function createNotesRouter(database) {
  const router = express.Router();
  const getNote = database.prepare('SELECT * FROM notes WHERE id = ?');
  const getNotes = database.prepare('SELECT * FROM notes ORDER BY id');
  const insertNote = database.prepare('INSERT INTO notes (title, content) VALUES (?, ?)');

  router.get('/', (request, response) => {
    if (Object.keys(request.query).length > 0) {
      return response.status(400).json({ error: 'The notes list does not accept query parameters.' });
    }

    return response.json(getNotes.all());
  });

  router.post('/', (request, response) => {
    const result = validateNoteInput(request.body, { create: true });
    if (result.error) {
      return response.status(400).json({ error: result.error });
    }

    const insert = insertNote.run(result.note.title, result.note.content);
    return response.status(201).json(getNote.get(insert.lastInsertRowid));
  });

  function updateNote(request, response, replace) {
    const noteId = parseNoteId(request.params.id);
    if (noteId === null) {
      return response.status(400).json({ error: 'Note id must be a positive integer.' });
    }

    const result = validateNoteInput(request.body, { replace });
    if (result.error) {
      return response.status(400).json({ error: result.error });
    }

    if (!getNote.get(noteId)) {
      return response.status(404).json({ error: 'Note not found.' });
    }

    const columns = Object.keys(result.note);
    const assignments = columns.map((column) => `${column} = ?`).join(', ');
    const values = columns.map((column) => result.note[column]);
    database.prepare(`UPDATE notes SET ${assignments} WHERE id = ?`).run(...values, noteId);

    return response.json(getNote.get(noteId));
  }

  router.put('/:id', (request, response) => updateNote(request, response, true));
  router.patch('/:id', (request, response) => updateNote(request, response, false));

  router.delete('/:id', (request, response) => {
    const noteId = parseNoteId(request.params.id);
    if (noteId === null) {
      return response.status(400).json({ error: 'Note id must be a positive integer.' });
    }

    const result = database.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
    if (result.changes === 0) {
      return response.status(404).json({ error: 'Note not found.' });
    }

    return response.status(204).end();
  });

  return router;
}

module.exports = createNotesRouter;