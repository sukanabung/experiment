const express = require('express');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

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
    await redisClient.ping();
    res.json({
      status: 'OK',
      service: 'notification-service',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'DEGRADED',
      error: error.message
    });
  }
});

async function subscribeToTodoEvents() {
  try {
    const subscriber = redisClient.duplicate();
    await subscriber.connect();

    await subscriber.subscribe('todo.created', (message) => {
      try {
        const todoData = JSON.parse(message);
        console.log('📧 [Notification] New todo created:', todoData);
        sendNotification(todoData);
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    });

    console.log('📬 Subscribed to todo.created channel');
  } catch (error) {
    console.error('Subscription error:', error);
  }
}

function sendNotification(todoData) {
  console.log(`💬 Sending notification for todo: ${todoData.title}`);
  console.log(`   User: ${todoData.userId}`);
  console.log(`   Time: ${todoData.timestamp}`);
  const notificationKey = `notification:${todoData.todoId}`;
  redisClient.setEx(
    notificationKey,
    86400,
    JSON.stringify({
      ...todoData,
      processedAt: new Date().toISOString(),
      status: 'sent'
    })
  ).catch(err => console.error('Failed to store notification:', err));
}

app.get('/api/notifications/:todoId', async (req, res) => {
  try {
    const { todoId } = req.params;
    const notificationKey = `notification:${todoId}`;
    const data = await redisClient.get(notificationKey);
    if (!data) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ error: 'Failed to get notification' });
  }
});

app.listen(port, () => {
  console.log(`Notification Service running on port ${port}`);
  console.log('Starting Redis subscription...');
  subscribeToTodoEvents();
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await redisClient.quit();
  process.exit(0);
});