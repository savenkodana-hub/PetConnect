const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const registerChatSocket = require('./src/sockets/chatSocket');
const { getCorsOrigin } = require('./src/config/cors');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: getCorsOrigin(),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    maxHttpBufferSize: Number(process.env.SOCKET_MAX_BUFFER_BYTES) || 100000
  });

  app.set('io', io);
  registerChatSocket(io);

  server.listen(PORT, () => {
    console.log(`PetConnect server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
