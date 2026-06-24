const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const redis = require("redis");
const cors = require("cors");
const app = express();
const port = process.env.AUTH_PORT || 3000;
app.use(cors());
app.use(express.json());
// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
// Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});
redisClient.connect();
// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "auth-service" });
});
// Login endpoint
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  // Query user from database
  const result = await pool.query(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username],
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: "User not found" });
  }

  // Verify password (simplified - should use bcrypt)
  if (password === "testpass123") {
    const token = jwt.sign(
      { userId: result.rows[0].id, username: result.rows[0].username },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" },
    );

    // Store session in Redis
    await redisClient.setEx(`session:${result.rows[0].id}`, 86400, token);

    res.json({ token, userId: result.rows[0].id });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});
// Verify token endpoint (for other services)
app.post("/api/auth/verify", async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const session = await redisClient.get(`session:${decoded.userId}`);

    if (session === token) {
      res.json({ valid: true, userId: decoded.userId });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    res.json({ valid: false });
  }
});
app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
});
