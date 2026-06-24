const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app = require('./app');
const http = require('http');

const port = process.env.TODO_PORT || process.env.PORT || '3001';
app.set('port', port);

const server = http.createServer(app);

server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  const bind = typeof port === 'string' ? 'pipe ' + port : 'port ' + port;
  if (error.code === 'EACCES') {
    console.error(bind + ' requires elevated privileges');
    process.exit(1);
  } else if (error.code === 'EADDRINUSE') {
    console.error(bind + ' is already in use');
    process.exit(1);
  } else {
    throw error;
  }
});

server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  console.log('✅ Todo API running on ' + bind);
});

app.locals.dbReady.then(() => {
  server.listen(port);
}).catch((err) => {
  console.error('❌ Todo service failed to initialize:', err);
  process.exit(1);
});