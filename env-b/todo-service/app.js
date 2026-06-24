const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');

const todoRoutes = require('./routes/todo');

const app = express();

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://todouser:todopass@127.0.0.1:5432/tododb';

const pool = new Pool({ connectionString: DATABASE_URL });
pool.on('error', (err) => console.error('❌ Postgres pool error:', err));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT 'N/A',
      deadline TIMESTAMP NULL,
      on_date TIMESTAMP NOT NULL DEFAULT NOW(),
      card_color TEXT NOT NULL DEFAULT '#cddc39',
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_on TIMESTAMP NOT NULL DEFAULT NOW(),
      modified_on TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_on TIMESTAMP NULL
    );
  `);
}

async function initDbWithRetry(maxAttempts = 10, delayMs = 3000) {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      await initDb();
      console.log('✅ Todo DB ready');
      return;
    } catch (err) {
      console.error(`❌ Todo DB init attempt ${attempt} failed:`, err.message || err);
      if (attempt === maxAttempts) {
        console.error('❌ Max todo DB retry attempts reached.');
        throw err;
      }
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

app.locals.dbReady = initDbWithRetry();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

app.use(cors());
app.use(express.static('.'));
app.use(['/todos', '/api/todos'], todoRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'todo-service' });
});

app.locals.pool = pool;

module.exports = app;