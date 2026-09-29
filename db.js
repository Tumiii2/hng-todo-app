const Database = require('better-sqlite3');

function createDatabase(filename = process.env.DATABASE_PATH || 'tasks.db') {
  const database = new Database(filename);

  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high'))
    )
  `);

  return database;
}

module.exports = createDatabase;