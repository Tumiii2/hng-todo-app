# AGENTS.md

## Project
A To-Do List web app with a notes feature and due dates/priority.
Owner is a junior frontend dev. Keep code simple, readable, and commented.

## Stack
- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)
- Frontend: plain HTML, Tailwind CSS (CDN), vanilla JavaScript in /public
- Tests: Jest + Supertest

## Structure
- server.js: starts the server
- app.js: Express app (exported for tests)
- db.js: database setup
- routes/tasks.js, routes/notes.js
- public/: index.html, app.js, styles
- tests/: API tests

## Features
1. Tasks: create, list, edit, complete, delete
2. Notes: create, list, edit, delete
3. Extra: due date + priority (low/medium/high) on tasks, filter by status

## API rules
- REST endpoints: /api/tasks and /api/notes (GET, POST, PUT/PATCH, DELETE)
- Validate input; return 400 for bad data, 404 if not found
- Return JSON with proper status codes
- Never crash the server on bad input

## Testing rules
- Every endpoint must have at least one success test and one failure test
- Run `npm test` after every change and fix failures before moving on
- Tests must use a separate in-memory database, not the real one

## Code rules
- Work on ONE feature at a time and explain what you changed in simple words
- No secrets in code; use environment variables
- Use the PORT environment variable (default 3000) so it deploys anywhere
- Add a "start" and "test" script in package.json
- Keep README updated with how to run, test, and the live URL

## Do not
- Do not add libraries without saying why
- Do not rewrite working code unless asked