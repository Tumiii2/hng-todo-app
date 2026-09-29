const express = require('express');
const createTasksRouter = require('./routes/tasks');

function createApp(database) {
  const app = express();

  app.use(express.json());

  app.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/tasks', createTasksRouter(database));

  app.use((error, request, response, next) => {
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Request body contains invalid JSON.' });
    }

    return next(error);
  });

  return app;
}

module.exports = createApp;