const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
// Allow Express to respect X-Forwarded-* headers set by reverse proxies (nginx)
// Trust only the first proxy (numeric 1) to avoid permissive trust that express-rate-limit rejects.
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

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
app.use('/api/auth', limiter);

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'postgres-auth',
  port: 5432,
  user: process.env.POSTGRES_USER || 'todouser',
  password: process.env.POSTGRES_PASSWORD || 'todopass',
  database: process.env.POSTGRES_DB || 'authdb',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redisClient.ping();
    res.json({
      status: 'OK',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      database: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'DEGRADED',
      error: error.message
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const checkUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (checkUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, passwordHash]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const identifier = username || email;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'default-secret-key-change-this',
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    const sessionKey = `session:${user.id}`;
    await redisClient.setEx(sessionKey, 86400, token);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      expiresIn: process.env.JWT_EXPIRY || '24h'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/auth/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ valid: false, error: 'Invalid token format' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key-change-this');
    const sessionKey = `session:${decoded.userId}`;
    const redisToken = await redisClient.get(sessionKey);
    if (redisToken !== token) {
      return res.status(401).json({ valid: false, error: 'Invalid session' });
    }

    res.json({
      valid: true,
      userId: decoded.userId,
      username: decoded.username
    });
  } catch (error) {
    console.error('Validate error:', error);
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(200).json({ message: 'Logged out' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key-change-this');
    await redisClient.del(`session:${decoded.userId}`);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.listen(port, () => {
  console.log(`Auth Service running on port ${port}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});