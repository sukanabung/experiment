const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Pool } = require('pg');
const axios = require('axios');
const redis = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const NOTIF_SERVICE_URL = process.env.NOTIF_SERVICE_URL || 'http://localhost:3002/notify';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://todouser:todopass@127.0.0.1:5432/tododb';

const pool = new Pool({ connectionString: DATABASE_URL });
pool.on('error', (err) => console.error('❌ Postgres pool error:', err));

const redisPublisher = redis.createClient({ url: REDIS_URL });
redisPublisher.on('error', (err) => console.error('❌ Redis Publisher Error:', err));
redisPublisher.connect().catch((err) => console.error('❌ Redis Publisher Connect Error:', err));

function mapTodoRow(row) {
    return {
        _id: row.id.toString(),
        id: row.id.toString(),
        userId: row.user_id,
        title: row.title,
        description: row.description,
        deadline: row.deadline ? row.deadline.toISOString() : null,
        onDate: row.on_date ? row.on_date.toISOString() : null,
        cardColor: row.card_color,
        isCompleted: row.is_completed,
        timestamps: {
            createdOn: row.created_on ? row.created_on.toISOString() : null,
            modifiedOn: row.modified_on ? row.modified_on.toISOString() : null,
            completedOn: row.completed_on ? row.completed_on.toISOString() : null,
        },
    };
}

exports.createTodo = async (req, res, next) => {
    console.log((new Date()).toISOString(), req.method, req.baseUrl);

    const { title, description = 'N/A', deadline, cardColor = '#cddc39' } = req.body;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `INSERT INTO todos (user_id, title, description, deadline, card_color)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, title, description, deadline || null, cardColor]
        );

        const createdTodo = mapTodoRow(result.rows[0]);

        try {
            await redisPublisher.publish('todo.created', JSON.stringify({
                title: createdTodo.title,
                deadline: createdTodo.deadline,
                userId: createdTodo.userId,
                todoId: createdTodo._id,
            }));
            console.log('✅ Published todo.created event to Redis');
        } catch (err) {
            console.error('⚠️ Redis publish failed:', err.message);
        }

        try {
            await axios.post(NOTIF_SERVICE_URL, {
                title: createdTodo.title,
                deadline: createdTodo.deadline,
                email: 'user_demo@gmail.com',
            });
            console.log('✅ Berhasil memanggil Notification Service');
        } catch (err) {
            console.error('⚠️ Gagal memanggil Notification Service (Pastikan Port 3002 Nyala)', err.message);
        }

        res.status(201).json({
            status: 'Success',
            message: 'Todo Created SuccessFully!',
            todo: createdTodo,
        });
    } catch (error) {
        res.status(500).json({
            status: 'Error',
            message: 'Error in DB Operation!',
            error: error.message || error,
        });
    }
};

exports.getTodos = async (req, res, next) => {
    console.log((new Date()).toISOString(), req.method, req.baseUrl);

    try {
        const result = await pool.query('SELECT * FROM todos WHERE user_id = $1 ORDER BY on_date DESC', [req.user.id]);
        const todos = result.rows.map(mapTodoRow);

        if (!todos.length) {
            return res.status(200).json({
                status: 'Success',
                message: 'No Todos found!',
                todos: [],
                todoCount: 0,
            });
        }

        res.status(200).json({
            status: 'Success',
            message: 'Todos Fetched Successfully!',
            todos,
            todoCount: todos.length,
        });
    } catch (error) {
        res.status(500).json({
            status: 'Error',
            message: 'Error in DB Operation!',
            error: error.message || error,
        });
    }
};

exports.getTodo = async (req, res, next) => {
    console.log((new Date()).toISOString(), req.method, req.baseUrl);
    const todoId = req.params.todoId;

    try {
        const result = await pool.query('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [todoId, req.user.id]);
        const todo = result.rows[0];

        if (!todo) {
            return res.status(404).json({
                status: 'Success',
                message: 'No Todo found with that Id!',
                todo,
            });
        }

        res.status(200).json({
            status: 'Success',
            message: 'Todo Fetched Successfully!',
            todo: mapTodoRow(todo),
        });
    } catch (error) {
        res.status(500).json({
            status: 'Error',
            message: 'Error in DB Operation!',
            error: error.message || error,
        });
    }
};

exports.updateTodo = async (req, res, next) => {
    console.log((new Date()).toISOString(), req.method, req.baseUrl);
    const todoId = req.params.todoId;
    const { title, description, deadline, cardColor } = req.body;

    try {
        const result = await pool.query(
            `UPDATE todos SET title = COALESCE($1, title), description = COALESCE($2, description),
            deadline = $3, card_color = COALESCE($4, card_color), modified_on = NOW()
            WHERE id = $5 AND user_id = $6 RETURNING *`,
            [title, description, deadline || null, cardColor, todoId, req.user.id]
        );

        const updatedTodo = result.rows[0];
        if (!updatedTodo) {
            return res.status(404).json({
                status: 'Error',
                message: 'Todo tidak ditemukan',
            });
        }

        res.status(201).json({
            status: 'Success',
            message: 'Todo Updated Successfully!',
            todo: mapTodoRow(updatedTodo),
        });
    } catch (error) {
        res.status(500).json({
            status: 'Error',
            message: 'Error in DB Operation!',
            error: error.message || error,
        });
    }
};

exports.completeTodo = async (req, res, next) => {
    console.log((new Date()).toISOString(), req.method, req.baseUrl);
    const todoId = req.params.todoId;

    try {
        const fetch = await pool.query('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [todoId, req.user.id]);
        const todo = fetch.rows[0];

        if (!todo) {
            return res.status(404).json({
                status: 'Error',
                message: 'Tugas tidak ditemukan',
            });
        }

        const nextStatus = !todo.is_completed;
        const result = await pool.query(
            nextStatus
                ? 'UPDATE todos SET is_completed = $1, modified_on = NOW(), completed_on = NOW() WHERE id = $2 AND user_id = $3 RETURNING *'
                : 'UPDATE todos SET is_completed = $1, modified_on = NOW(), completed_on = NULL WHERE id = $2 AND user_id = $3 RETURNING *',
            [nextStatus, todoId, req.user.id]
        );

        const updatedTodo = result.rows[0];

        res.status(201).json({
            status: 'Success',
            message: nextStatus ? 'Tugas Selesai!' : 'Status Dibatalkan (Aktif Kembali)',
            todo: mapTodoRow(updatedTodo),
        });
    } catch (error) {
        res.status(500).json({
            status: 'Error',
            message: 'Error in DB Operation!',
            error: error.message || error,
        });
    }
};

exports.deleteTodo = async (req, res, next) => {
    console.log((new Date()).toISOString(), req.method, req.baseUrl);
    const todoId = req.params.todoId;

    try {
        const result = await pool.query('DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *', [todoId, req.user.id]);
        if (!result.rows.length) {
            return res.status(404).json({
                status: 'Error',
                message: 'Todo tidak ditemukan',
            });
        }

        res.status(201).json({
            status: 'Success',
            message: 'Todo Deleted Successfully!',
        });
    } catch (error) {
        res.status(500).json({
            status: 'Error',
            message: 'Error in DB Operation!',
            error: error.message || error,
        });
    }
};