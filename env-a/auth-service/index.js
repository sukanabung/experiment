const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const redis = require('redis');

const app = express();
app.use(express.json());
app.use(cors());

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://todouser:todopass@127.0.0.1:5432/authdb';
const AUTH_PORT = process.env.AUTH_PORT || process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const pool = new Pool({ connectionString: DATABASE_URL });
pool.on('error', (err) => console.error('❌ Postgres pool error:', err));

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
}

async function initDbWithRetry(maxAttempts = 10, delayMs = 3000) {
    let attempt = 1;
    while (attempt <= maxAttempts) {
        try {
            await initDb();
            console.log('✅ Auth DB ready');
            return;
        } catch (err) {
            console.error(`❌ Auth DB init attempt ${attempt} failed:`, err.message || err);
            if (attempt === maxAttempts) {
                console.error('❌ Max auth DB retry attempts reached.');
                throw err;
            }
            await sleep(delayMs);
            attempt += 1;
        }
    }
}

const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('❌ Redis Client Error:', err));

async function startApp() {
    await initDbWithRetry();
    await redisClient.connect();
    console.log('✅ Redis Connected');
    app.listen(AUTH_PORT, () => console.log(`🛡️ Auth Service running on port ${AUTH_PORT}`));
}

startApp().catch((err) => {
    console.error('❌ Startup failed:', err);
    process.exit(1);
});

const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Semua kolom wajib diisi!' });
        }

        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length) {
            return res.status(400).json({ message: 'Email sudah terdaftar!' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
            [username, email, passwordHash]
        );

        console.log(`✅ User Baru Terdaftar: ${email}`);
        res.status(201).json({ message: 'Registrasi Berhasil! Silakan Login.' });
    } catch (error) {
        console.error('❌ ERROR REGISTER (Detail):', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT id, username, password_hash FROM users WHERE email = $1', [email]);

        if (!result.rows.length) {
            return res.status(400).json({ message: 'Email tidak ditemukan' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Password salah!' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        await redisClient.setEx(`session:${user.id}`, 86400, token);

        res.json({ message: 'Login Berhasil', token, user: { username: user.username } });
    } catch (error) {
        console.error('❌ ERROR LOGIN (Detail):', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

authRouter.post('/verify', async (req, res) => {
    const token = req.body.token || req.header('x-auth-token');
    if (!token) {
        return res.status(400).json({ valid: false, message: 'Token tidak ditemukan' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const session = await redisClient.get(`session:${decoded.id}`);

        if (session !== token) {
            return res.json({ valid: false });
        }

        res.json({ valid: true, userId: decoded.id, username: decoded.username });
    } catch (error) {
        res.json({ valid: false });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'auth-service' });
});

app.use(['/auth', '/api/auth'], authRouter);
