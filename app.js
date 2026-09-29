const express = require('express');
const path = require('path');
const createNotesRouter = require('./routes/notes');
const createTasksRouter = require('./routes/tasks');

function createApp(database) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/tasks', createTasksRouter(database));
  app.use('/api/notes', createNotesRouter(database));

  app.use((error, request, response, next) => {
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Request body contains invalid JSON.' });
    }

    return next(error);
  });

  return app;
}

module.exports = createApp;