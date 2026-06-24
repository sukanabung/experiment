const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://todouser:todopass@host.docker.internal:5432/authdb';

const users = [
  { username: 'testuser1', email: 'testuser1@example.com', password: 'testpass123' },
  { username: 'testuser2', email: 'testuser2@example.com', password: 'testpass123' },
  { username: 'testuser3', email: 'testuser3@example.com', password: 'testpass123' },
  { username: 'testuser4', email: 'testuser4@example.com', password: 'testpass123' },
  { username: 'testuser5', email: 'testuser5@example.com', password: 'testpass123' }
];

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    console.log('Connecting to DB:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      await pool.query(
        `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, username = EXCLUDED.username;`,
        [u.username, u.email, hash]
      );
      console.log(`Seeded user: ${u.email}`);
    }

    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
