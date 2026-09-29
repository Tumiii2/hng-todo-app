# TickIt by Eniola

Live app: [https://tickit-eniola.onrender.com](https://tickit-eniola.onrender.com)

The free plan may sleep after inactivity, and stored data may reset.

## Run locally

Install dependencies and start the server:

```sh
npm install
npm start
```

Open the health check at [http://localhost:3000/health](http://localhost:3000/health). Set the `PORT` environment variable to use a different port.

Run tests with:

```sh
npm test
```

## Tasks API

- `GET /api/tasks` lists tasks. Add `?completed=true` or `?completed=false` to filter by status.
- `POST /api/tasks` creates a task. `title` is required; `completed` defaults to `false`, `due_date` to `null`, and `priority` to `medium`.
- `PUT /api/tasks/:id` replaces a task and requires `title`, `completed`, `due_date`, and `priority`.
- `PATCH /api/tasks/:id` updates any supplied task fields.
- `DELETE /api/tasks/:id` deletes a task.
- `GET /api/notes` lists notes.
- `POST /api/notes` creates a note with required `title` and `content` fields.
- `PUT /api/notes/:id` replaces a note and requires both `title` and `content`.
- `PATCH /api/notes/:id` updates either or both supplied note fields.
- `DELETE /api/notes/:id` deletes a note.

Task priorities are `low`, `medium`, or `high`; due dates use `YYYY-MM-DD` or `null`. The server stores tasks in `tasks.db` by default. Set `DATABASE_PATH` to use a different database file.
