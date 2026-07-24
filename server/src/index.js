require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { connectRedis } = require('./config/redis');
const connectDB = require('./config/database');
const initSocket = require('./socket');
const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');
const contactsRoutes = require('./routes/contacts');
const messagesRoutes = require('./routes/messages');
const healthRoutes = require('./routes/health');
const { startWhatsApp } = require('./services/baileysService');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const io = initSocket(server);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/messages', messagesRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../public')));
app.use('/data', express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await connectRedis();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  try {
    await startWhatsApp();
  } catch (error) {
    console.error('Failed to start WhatsApp:', error.message);
  }
};

startServer();

module.exports = { app, server, io };
