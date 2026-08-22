const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const { setGlobalMessageHandler, setGlobalQRHandler, getCanonicalJid } = require('../services/baileysService');
const { saveMessage, markAsRead } = require('../controllers/messageController');
const Contact = require('../models/Contact');
const { buildConversationKey } = require('../utils/conversationKey');

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

  setGlobalMessageHandler(async ({ tenantId, channelId, msg }) => {
    if (!msg?.key) return;

    const { remoteJid: rawRemoteJid, id } = msg.key;
    let remoteJid = getCanonicalJid(channelId, String(rawRemoteJid));
    // Preserve a LID mapping learned before a server restart.
    if (remoteJid.endsWith('@lid')) {
      const knownContact = await Contact.findOne({ tenantId, aliases: remoteJid }).select('jid');
      if (knownContact?.jid) remoteJid = knownContact.jid;
    }
    const fromMe = msg.key.fromMe || false;
    const actualSender = msg.key?.participant || msg.key?.remoteJid || '';
    const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

    // Ignore WhatsApp protocol/control traffic; it is not a conversation item.
    if (!remoteJid || remoteJid === 'status@broadcast' || msg.message?.protocolMessage || msg.message?.senderKeyDistributionMessage) return;

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

    try {
      const result = await saveMessage({
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
      const saved = result.message;

      // Broadcast even for a retry: the client-side message id de-duplicates
      // it, and a temporarily disconnected browser can still recover it.
      const conversationKey = buildConversationKey(channelId, String(remoteJid));
      io.to(`tenant:${tenantId}`).emit('new_message', {
        remoteJid: String(remoteJid),
        conversationKey,
        message: saved,
      });
    
    // Trigger Workflow Engine
    const { processEvent } = require('../services/workflowEngine');
      if (!fromMe && result.created) {
        const contact = await Contact.findOne({ tenantId, jid: String(remoteJid) }).select('_id');
        await processEvent(tenantId, 'message_received', {
          tenantId,
          channelId,
          remoteJid: String(remoteJid),
          contactId: contact?._id || null,
          message: messageContent,
          isFirstMessage: !contact
        });
      }
    } catch (error) {
      // Never let one malformed/replayed event stop processing later messages.
      console.error(`[Socket] Could not persist message ${id || 'unknown'}:`, error.message);
    }
  });

  setGlobalQRHandler(async ({ tenantId, channelId, qr }) => {
    // Send QR only to users of this tenant
    io.to(`tenant:${tenantId}`).emit('qr_code', qr);
  });

  io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}, Tenant: ${socket.user.tenantId}`);
    
    // Join tenant room to receive tenant-specific events
    socket.join(`tenant:${socket.user.tenantId}`);

    socket.on('join_chat', async ({ jid, channelId } = {}) => {
      if (!jid) return;
      const conversationKey = buildConversationKey(channelId, jid);
      await markAsRead(socket.user.tenantId, jid, channelId);
      socket.join(`chat:${conversationKey}`);
      socket.emit('messages_marked_read', { jid, channelId, conversationKey });
    });

    socket.on('leave_chat', ({ jid, channelId } = {}) => {
      if (!jid) return;
      socket.leave(`chat:${buildConversationKey(channelId, jid)}`);
    });

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initSocket;
