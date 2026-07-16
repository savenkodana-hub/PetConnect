const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const friendRoutes = require('./routes/friendRoutes');
const groupRoutes = require('./routes/groupRoutes');
const healthRoutes = require('./routes/healthRoutes');
const messageRoutes = require('./routes/messageRoutes');
const petRoutes = require('./routes/petRoutes');
const postRoutes = require('./routes/postRoutes');
const statsRoutes = require('./routes/statsRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { getCorsOrigin } = require('./config/cors');

const app = express();

app.use(cors({ origin: getCorsOrigin() }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  index: false
}));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/stats', statsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
