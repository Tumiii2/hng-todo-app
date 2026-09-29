const express = require('express');

const allowedFields = new Set(['title', 'completed', 'due_date', 'priority']);
const validPriorities = new Set(['low', 'medium', 'high']);
const validDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!validDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateTaskInput(body, { create = false, replace = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const fields = Object.keys(body);
  if (fields.length === 0) {
    return { error: 'Request body must include task fields.' };
  }

  if (fields.some((field) => !allowedFields.has(field))) {
    return { error: 'Request body contains an unsupported field.' };
  }

  if (create && !Object.hasOwn(body, 'title')) {
    return { error: 'title is required.' };
  }

  if (replace && ['title', 'completed', 'due_date', 'priority'].some((field) => !Object.hasOwn(body, field))) {
    return { error: 'PUT requires title, completed, due_date, and priority.' };
  }

  const task = {};

  if (Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return { error: 'title must be a non-empty string.' };
    }
    task.title = body.title.trim();
  }

  if (Object.hasOwn(body, 'completed')) {
    if (typeof body.completed !== 'boolean') {
      return { error: 'completed must be a boolean.' };
    }
    task.completed = body.completed;
  }

  if (Object.hasOwn(body, 'due_date')) {
    if (body.due_date !== null && (typeof body.due_date !== 'string' || !isValidDate(body.due_date))) {
      return { error: 'due_date must be a valid YYYY-MM-DD date or null.' };
    }
    task.due_date = body.due_date;
  }

  if (Object.hasOwn(body, 'priority')) {
    if (typeof body.priority !== 'string' || !validPriorities.has(body.priority)) {
      return { error: 'priority must be low, medium, or high.' };
    }
    task.priority = body.priority;
  }

  return { task };
}

function serializeTask(task) {
  return { ...task, completed: Boolean(task.completed) };
}

function parseTaskId(value) {
  const taskId = Number(value);
  return Number.isSafeInteger(taskId) && taskId > 0 ? taskId : null;
}

function createTasksRouter(database) {
  const router = express.Router();
  const getTask = database.prepare('SELECT * FROM tasks WHERE id = ?');
  const getTasks = database.prepare('SELECT * FROM tasks ORDER BY id');
  const getTasksByStatus = database.prepare('SELECT * FROM tasks WHERE completed = ? ORDER BY id');
  const insertTask = database.prepare(
    'INSERT INTO tasks (title, completed, due_date, priority) VALUES (?, ?, ?, ?)'
  );

  router.get('/', (request, response) => {
    const queryFields = Object.keys(request.query);
    if (queryFields.some((field) => field !== 'completed')) {
      return response.status(400).json({ error: 'Only the completed query parameter is supported.' });
    }

    const { completed } = request.query;
    if (completed !== undefined && completed !== 'true' && completed !== 'false') {
      return response.status(400).json({ error: 'completed must be true or false.' });
    }

    const tasks = completed === undefined
      ? getTasks.all()
      : getTasksByStatus.all(completed === 'true' ? 1 : 0);

    return response.json(tasks.map(serializeTask));
  });

  router.post('/', (request, response) => {
    const result = validateTaskInput(request.body, { create: true });
    if (result.error) {
      return response.status(400).json({ error: result.error });
    }

    const task = {
      title: result.task.title,
      completed: result.task.completed ?? false,
      due_date: result.task.due_date ?? null,
      priority: result.task.priority ?? 'medium'
    };
    const insert = insertTask.run(
      task.title,
      Number(task.completed),
      task.due_date,
      task.priority
    );

    return response.status(201).json(serializeTask(getTask.get(insert.lastInsertRowid)));
  });

  function updateTask(request, response, replace) {
    const taskId = parseTaskId(request.params.id);
    if (taskId === null) {
      return response.status(400).json({ error: 'Task id must be a positive integer.' });
    }

    const result = validateTaskInput(request.body, { replace });
    if (result.error) {
      return response.status(400).json({ error: result.error });
    }

    if (!getTask.get(taskId)) {
      return response.status(404).json({ error: 'Task not found.' });
    }

    const columns = Object.keys(result.task);
    const assignments = columns.map((column) => `${column} = ?`).join(', ');
    const values = columns.map((column) => (
      column === 'completed' ? Number(result.task[column]) : result.task[column]
    ));
    database.prepare(`UPDATE tasks SET ${assignments} WHERE id = ?`).run(...values, taskId);

    return response.json(serializeTask(getTask.get(taskId)));
  }

  router.put('/:id', (request, response) => updateTask(request, response, true));
  router.patch('/:id', (request, response) => updateTask(request, response, false));

  router.delete('/:id', (request, response) => {
    const taskId = parseTaskId(request.params.id);
    if (taskId === null) {
      return response.status(400).json({ error: 'Task id must be a positive integer.' });
    }

    const result = database.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    if (result.changes === 0) {
      return response.status(404).json({ error: 'Task not found.' });
    }

    return response.status(204).end();
  });

  return router;
}

module.exports = createTasksRouter;