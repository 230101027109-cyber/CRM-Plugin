const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const { setGlobalMessageHandler, setGlobalQRHandler } = require('../services/baileysService');
const { saveMessage, markAsRead } = require('../controllers/messageController');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
      credentials: true,
    },
  });

  const authenticateSocket = (token) => {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
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
    console.log(`Client connected: ${socket.id}, Tenant: ${socket.user.tenantId}`);
    
    // Join tenant room to receive tenant-specific events
    socket.join(`tenant:${socket.user.tenantId}`);

    setGlobalMessageHandler(async ({ tenantId, channelId, msg }) => {
      if (!msg?.key) return;

      const { remoteJid, id } = msg.key;
      const fromMe = msg.key.fromMe || false;
      const actualSender = msg.key?.participant || msg.key?.remoteJid || '';
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
        tenantId,
        channelId,
        remoteJid: String(remoteJid),
        senderJid: String(actualSender),
        content: messageContent,
        messageType,
        fromMe,
        timestamp,
        participants: [String(msg.key?.participant || remoteJid)],
      });

      // Broadcast to all users in this tenant
      io.to(`tenant:${tenantId}`).emit('new_message', {
        remoteJid: String(remoteJid),
        message: saved,
      });
      
      // Trigger Workflow Engine
      const { processEvent } = require('../services/workflowEngine');
      
      // Only process incoming messages (not fromMe) to prevent infinite loops with auto-replies
      if (!fromMe) {
        // We'll need the contact to know if it's new, etc.
        // For simplicity in this demo, let's just trigger 'message_received'
        await processEvent(tenantId, 'message_received', {
          tenantId,
          channelId,
          remoteJid: String(remoteJid),
          contactId: null, // Ideally we query or create contact first
          message: messageContent,
          isFirstMessage: false // Needs actual check in prod
        });
      }
    });

    setGlobalQRHandler(async ({ tenantId, channelId, qr }) => {
      // Send QR only to users of this tenant
      io.to(`tenant:${tenantId}`).emit('qr_code', qr);
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
