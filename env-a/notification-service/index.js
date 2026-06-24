const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const redis = require('redis');

const app = express();
const NOTIF_PORT = process.env.NOTIF_PORT || process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

app.use(cors());
app.use(express.json());

const subscriber = redis.createClient({ url: REDIS_URL });
subscriber.on('error', (err) => console.error('❌ Redis Subscriber Error:', err));
subscriber.connect()
    .then(() => {
        console.log('✅ Notification Service connected to Redis');
        return subscriber.subscribe('todo.created', (message) => {
            try {
                const payload = JSON.parse(message);
                console.log('========================================');
                console.log('[SERVICE NOTIFIKASI] Event todo.created diterima:');
                console.log(`📧 Mengirim Email ke User...`);
                console.log(`📝 Judul Tugas : ${payload.title}`);
                console.log(`📅 Deadline    : ${payload.deadline || 'Tidak ada deadline'}`);
                console.log('========================================');
            } catch (err) {
                console.log('⚠️ Notifikasi Redis event:', message);
            }
        });
    })
    .catch((err) => console.error('❌ Redis connection failed:', err));

app.post('/notify', (req, res) => {
    const { title, deadline } = req.body;

    if (!title) {
        return res.status(400).json({ status: 'error', message: 'Title is required' });
    }

    console.log('========================================');
    console.log('[SERVICE NOTIFIKASI] Menerima Data Baru:');
    console.log('📧 Mengirim Email ke User...');
    console.log(`📝 Judul Tugas : ${title}`);
    console.log(`📅 Deadline    : ${deadline || 'Tidak ada deadline'}`);
    console.log('========================================');

    res.json({ status: 'Email Sent Successfully' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'notification-service' });
});

app.listen(NOTIF_PORT, () => {
    console.log(`📢 Notification Service lari di Port ${NOTIF_PORT}`);
});