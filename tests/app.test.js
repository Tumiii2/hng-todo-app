const request = require('supertest');
const createApp = require('../app');
const createDatabase = require('../db');

describe('API', () => {
  let app;
  let database;

  beforeEach(() => {
    database = createDatabase(':memory:');
    app = createApp(database);
  });

  afterEach(() => {
    database.close();
  });

  async function createTask(overrides = {}) {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Write tests', ...overrides });

    return response.body;
  }

  it('keeps the health check available', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  describe('GET /api/tasks', () => {
    it('lists tasks and can filter by completion status', async () => {
      await createTask();
      await createTask({ title: 'Ship feature', completed: true });

      const response = await request(app).get('/api/tasks?completed=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ title: 'Ship feature', completed: true });
    });

    it('rejects an invalid completion filter', async () => {
      const response = await request(app).get('/api/tasks?completed=sometimes');

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/tasks', () => {
    it('creates a task with defaults and supplied values', async () => {
      const response = await request(app).post('/api/tasks').send({
        title: 'Submit report',
        due_date: '2026-10-01',
        priority: 'high'
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'Submit report',
        completed: false,
        due_date: '2026-10-01',
        priority: 'high'
      });
      expect(response.body.id).toEqual(expect.any(Number));
    });

    it('rejects an empty title', async () => {
      const response = await request(app).post('/api/tasks').send({ title: '  ' });

      expect(response.status).toBe(400);
    });

    it('returns JSON for malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title":');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Request body contains invalid JSON.' });
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('replaces all task fields', async () => {
      const task = await createTask();
      const response = await request(app).put(`/api/tasks/${task.id}`).send({
        title: 'Review report',
        completed: true,
        due_date: null,
        priority: 'low'
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: task.id,
        title: 'Review report',
        completed: true,
        due_date: null,
        priority: 'low'
      });
    });

    it('rejects an incomplete replacement', async () => {
      const task = await createTask();
      const response = await request(app).put(`/api/tasks/${task.id}`).send({ title: 'Replace task' });

      expect(response.status).toBe(400);
    });

    it('returns 404 when the task does not exist', async () => {
      const response = await request(app).put('/api/tasks/999').send({
        title: 'Missing task',
        completed: false,
        due_date: null,
        priority: 'medium'
      });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('updates only the supplied fields', async () => {
      const task = await createTask();
      const response = await request(app).patch(`/api/tasks/${task.id}`).send({ completed: true });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: task.id,
        title: 'Write tests',
        completed: true,
        priority: 'medium'
      });
    });

    it('rejects an invalid priority', async () => {
      const task = await createTask();
      const response = await request(app).patch(`/api/tasks/${task.id}`).send({ priority: 'urgent' });

      expect(response.status).toBe(400);
    });

    it('returns 404 when the task does not exist', async () => {
      const response = await request(app).patch('/api/tasks/999').send({ completed: true });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('deletes an existing task', async () => {
      const task = await createTask();
      const response = await request(app).delete(`/api/tasks/${task.id}`);

      expect(response.status).toBe(204);
      await expect(request(app).get('/api/tasks')).resolves.toMatchObject({ body: [] });
    });

    it('returns 404 when the task does not exist', async () => {
      const response = await request(app).delete('/api/tasks/999');

      expect(response.status).toBe(404);
    });
  });

  it('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/unknown');

    expect(response.status).toBe(404);
  });
});