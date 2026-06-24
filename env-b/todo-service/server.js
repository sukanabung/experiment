const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const redis = require("redis");
const cors = require("cors");
const helmet = require("helmet");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

// Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
  }),
);
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use("/api/todos", limiter);

// Database Connection
const pool = new Pool({
  host: process.env.DATABASE_HOST || "postgres-todo",
  port: 5432,
  user: process.env.POSTGRES_USER || "todouser",
  password: process.env.POSTGRES_PASSWORD || "todopass",
  database: process.env.POSTGRES_DB || "tododb",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis Connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://redis:6379",
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.on("connect", () => console.log("Redis Connected"));

redisClient.connect();

// Auth Service URL
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://auth-service:3000";

// Health Check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    await redisClient.ping();
    res.json({
      status: "OK",
      service: "todo-service",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "DEGRADED",
      error: error.message,
    });
  }
});

// Authentication Middleware
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/auth/validate`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      },
    );

    if (response.data.valid) {
      req.userId = response.data.userId;
      req.username = response.data.username;
      next();
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
  } catch (error) {
    console.error("Auth error:", error);
    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "Auth service unavailable",
      });
    }
    res.status(401).json({ error: "Authentication failed" });
  }
}

// Get All Todos
app.get("/api/todos", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId],
    );

    res.json({
      todos: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get todos error:", error);
    res.status(500).json({ error: "Failed to fetch todos" });
  }
});

// Get Single Todo
app.get("/api/todos/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM todos WHERE id = $1 AND user_id = $2",
      [id, req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get todo error:", error);
    res.status(500).json({ error: "Failed to fetch todo" });
  }
});

// Create Todo
app.post("/api/todos", authenticateToken, async (req, res) => {
  try {
    const { title, description, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const result = await pool.query(
      `INSERT INTO todos (user_id, title, description, due_date) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
      [req.userId, title, description, due_date],
    );

    const todo = result.rows[0];

    try {
      await redisClient.publish(
        "todo.created",
        JSON.stringify({
          todoId: todo.id,
          userId: req.userId,
          title: todo.title,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (pubError) {
      console.error("Redis publish error:", pubError);
    }

    res.status(201).json(todo);
  } catch (error) {
    console.error("Create todo error:", error);
    res.status(500).json({ error: "Failed to create todo" });
  }
});

// Update Todo
app.put("/api/todos/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed, due_date } = req.body;

    const checkResult = await pool.query(
      "SELECT * FROM todos WHERE id = $1 AND user_id = $2",
      [id, req.userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
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
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id, req.userId);
    const query = `
            UPDATE todos 
            SET ${updates.join(", ")} 
            WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
            RETURNING *
        `;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update todo error:", error);
    res.status(500).json({ error: "Failed to update todo" });
  }
});

// Delete Todo
app.delete("/api/todos/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    res.json({
      message: "Todo deleted successfully",
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error("Delete todo error:", error);
    res.status(500).json({ error: "Failed to delete todo" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Todo Service running on port ${port}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing connections...");
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});
