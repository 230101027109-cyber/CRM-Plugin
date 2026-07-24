const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const { setMessageHandler, setContactUpdateHandler, setQRHandler, getCurrentUserJid } = require('../services/baileysService');
const { saveMessage, markAsRead } = require('../controllers/messageController');
const { syncContacts } = require('../controllers/contactController');
const { redisClient } = require('../config/redis');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
      credentials: true,
    },
  });

  const authenticateSocket = (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch {
      return null;
    }
  };

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = authenticateSocket(token);
    if (!user) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  });

  io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}`);

    setMessageHandler(async (msg) => {
      if (!msg?.key) return;

      const { remoteJid, id } = msg.key;
      const fromMe = msg.key.fromMe || false;
      const currentUser = getCurrentUserJid();
      const actualSender = fromMe ? currentUser : (msg.key?.participant || msg.key?.remoteJid || currentUser || '');
      const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

      const messageContent = msg.message?.conversation ||
                             msg.message?.extendedTextMessage?.text ||
                             msg.message?.imageMessage?.caption ||
                             msg.message?.videoMessage?.caption ||
                             '';

      const messageType = msg.message?.imageMessage ? 'image' :
                          msg.message?.videoMessage ? 'video' :
                          msg.message?.audioMessage ? 'audio' :
                          msg.message?.documentMessage ? 'document' :
                          msg.message?.stickerMessage ? 'sticker' :
                          'text';

      const saved = await saveMessage({
        messageId: id || uuid.v4(),
        remoteJid: String(remoteJid),
        senderJid: String(actualSender),
        content: messageContent,
        messageType,
        fromMe,
        timestamp,
        participants: [String(fromMe ? (currentUser || remoteJid) : (msg.key?.participant || remoteJid))],
      });

      socket.broadcast.emit('new_message', {
        remoteJid: String(remoteJid),
        message: saved,
      });

      socket.emit('new_message', {
        remoteJid: String(remoteJid),
        message: saved,
      });
    });

    setContactUpdateHandler(async (updates) => {
      socket.emit('contacts_updated', updates);
    });

    setQRHandler(async (qr) => {
      socket.emit('qr_code', qr);
    });

    socket.on('join_chat', async (jid) => {
      await markAsRead(jid);
      socket.join(`chat:${jid}`);
      socket.emit('messages_marked_read', { jid });
    });

    socket.on('leave_chat', (jid) => {
      socket.leave(`chat:${jid}`);
    });

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initSocket;
