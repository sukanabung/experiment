const express = require("express");
const router = express.Router();
const TodoController = require('../controllers/todo');
const auth = require('../middleware/auth'); // <-- 1. Panggil Satpamnya

// 2. Pasang 'auth' di tengah-tengah setiap route
// Artinya: "Sebelum jalankan Controller, cek dulu tiketnya (auth)"

// Buat Tugas Baru (Harus Login)
router.post('/', auth, TodoController.createTodo);

// Lihat Semua Tugas (Harus Login)
router.get('/', auth, TodoController.getTodos);

// Lihat 1 Tugas Spesifik (Harus Login)
router.get('/:todoId', auth, TodoController.getTodo);

// Edit Tugas (Harus Login)
router.put('/:todoId', auth, TodoController.updateTodo);

// Tandai Selesai (Harus Login)
router.patch('/:todoId', auth, TodoController.completeTodo);

// Hapus Tugas (Harus Login)
router.delete('/:todoId', auth, TodoController.deleteTodo);

module.exports = router;