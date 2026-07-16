const jwt = require('jsonwebtoken');

const {
  createMessage,
  ensureValidReceiver
} = require('../controllers/messageController');
const User = require('../models/User');

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  const headerToken = socket.handshake.headers.authorization;

  if (authToken) {
    return authToken;
  }

  if (headerToken && headerToken.startsWith('Bearer ')) {
    return headerToken.split(' ')[1];
  }

  return null;
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = getTokenFromSocket(socket);

    if (!token) {
      throw new Error('Socket authentication token missing');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new Error('Socket user not found');
    }

    socket.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const registerChatSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userRoom = socket.user._id.toString();

    socket.join(userRoom);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`Socket connected: ${socket.id} for user ${userRoom}`);
    }

    socket.on('sendMessage', async (payload, callback) => {
      const socketResponse = {
        statusCode: 500,
        status(code) {
          socketResponse.statusCode = code;
          return socketResponse;
        }
      };
      try {
        const { receiver, text } = payload || {};

        if (typeof receiver !== 'string') {
          socketResponse.status(400);
          throw new Error('receiver must be a valid ObjectId');
        }

        if (typeof text !== 'string' || !text.trim()) {
          socketResponse.status(400);
          throw new Error('Message text is required');
        }

        if (text.length > 2000) {
          socketResponse.status(400);
          throw new Error('Message text cannot exceed 2000 characters');
        }

        await ensureValidReceiver(receiver, socket.user._id, socketResponse);

        const message = await createMessage({
          senderId: socket.user._id,
          receiverId: receiver,
          text: text.trim()
        });

        io.to(message.receiver._id.toString()).emit('receiveMessage', message);
        io.to(message.sender._id.toString()).emit('receiveMessage', message);

        if (callback) {
          callback({ ok: true, message });
        }
      } catch (error) {
        if (callback) {
          callback({
            ok: false,
            error: socketResponse.statusCode < 500 ? error.message : 'Could not send message'
          });
        }

      }
    });

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Socket disconnected: ${socket.id} for user ${userRoom}`);
      }
    });
  });
};

module.exports = registerChatSocket;
