const createApp = require('./app');
const createDatabase = require('./db');

const port = process.env.PORT || 3000;
const database = createDatabase();
const app = createApp(database);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});