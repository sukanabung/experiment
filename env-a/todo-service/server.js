const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/todos', limiter);

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'postgres-todo',
  port: 5432,
  user: process.env.POSTGRES_USER || 'todouser',
  password: process.env.POSTGRES_PASSWORD || 'todopass',
  database: process.env.POSTGRES_DB || 'tododb',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function ensureSchema() {
  try {
    await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#cddc39';`);
    await pool.query(`UPDATE todos SET card_color = '#cddc39' WHERE card_color IS NULL;`);
    console.log('✅ todo-service schema check complete');
  } catch (err) {
    console.error('❌ Schema migration failed:', err);
    throw err;
  }
}

ensureSchema().catch((err) => {
  console.error('Failed to ensure database schema on startup', err);
});

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Connected'));
redisClient.connect();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';

function mapTodoRow(row) {
  const dueDate = row.due_date || null;
  const completedAt = row.completed_at || null;
  const createdAt = row.created_at || null;
  const updatedAt = row.updated_at || null;

  return {
    _id: row.id ? row.id.toString() : undefined,
    id: row.id ? row.id.toString() : undefined,
    userId: row.user_id,
    title: row.title,
    description: row.description || '-',
    deadline: dueDate ? new Date(dueDate).toISOString() : null,
    cardColor: row.card_color || '#cddc39',
    isCompleted: row.completed,
    timestamps: {
      createdOn: createdAt ? new Date(createdAt).toISOString() : null,
      modifiedOn: updatedAt ? new Date(updatedAt).toISOString() : null,
      completedOn: completedAt ? new Date(completedAt).toISOString() : null,
    }
  };
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redisClient.ping();
    res.json({
      status: 'OK',
      service: 'todo-service',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'DEGRADED',
      error: error.message
    });
  }
});

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/auth/validate`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 5000
      }
    );

    if (response.data.valid) {
      req.userId = response.data.userId;
      req.username = response.data.username;
      next();
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Auth service unavailable' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
}

app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    const todos = result.rows.map(mapTodoRow);
    res.json({
      todos,
      count: todos.length
    });
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

app.get('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM todos WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(mapTodoRow(result.rows[0]));
  } catch (error) {
    console.error('Get todo error:', error);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

app.post('/api/todos', authenticateToken, async (req, res) => {
  try {
    const { title, description = 'N/A', deadline, cardColor = '#cddc39' } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      `INSERT INTO todos (user_id, title, description, due_date, card_color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, title, description || 'N/A', deadline || null, cardColor]
    );

    const todo = mapTodoRow(result.rows[0]);

    try {
      await redisClient.publish(
        'todo.created',
        JSON.stringify({
          todoId: todo.id,
          userId: req.userId,
          title: todo.title,
          timestamp: new Date().toISOString()
        })
      );
    } catch (pubError) {
      console.error('Redis publish error:', pubError);
    }

    res.status(201).json(todo);
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed, deadline, cardColor } = req.body;

    const checkResult = await pool.query(
      'SELECT * FROM todos WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (completed !== undefined) {
      updates.push(`completed = $${paramCount++}`);
      values.push(completed);
    }
    if (deadline !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(deadline);
    }
    if (cardColor !== undefined) {
      updates.push(`card_color = $${paramCount++}`);
      values.push(cardColor);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, req.userId);
    const query = `
      UPDATE todos
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    res.json(mapTodoRow(result.rows[0]));
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

app.patch('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const todoResult = await pool.query('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (!todoResult.rows.length) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const currentTodo = todoResult.rows[0];
    const currentCompleted = currentTodo.completed;
    const nextStatus = !currentCompleted;
    const updateResult = await pool.query(
      nextStatus
        ? 'UPDATE todos SET completed = $1, updated_at = NOW(), completed_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *'
        : 'UPDATE todos SET completed = $1, updated_at = NOW(), completed_at = NULL WHERE id = $2 AND user_id = $3 RETURNING *',
      [nextStatus, id, req.userId]
    );

    res.json(mapTodoRow(updateResult.rows[0]));
  } catch (error) {
    console.error('Patch todo error:', error);
    res.status(500).json({ error: 'Failed to update todo status' });
  }
});

app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({
      message: 'Todo deleted successfully',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

app.listen(port, () => {
  console.log(`Todo Service running on port ${port}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});