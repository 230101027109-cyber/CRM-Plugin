const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const Channel = require('../models/Channel');

const sessions = new Map(); // Map to store multiple socket instances by channelId
const sessionHandlers = new Map(); // Handlers per channel

const sessionPath = path.resolve(process.env.STORE_PATH || path.join(__dirname, '../../data/baileys'));

if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

// Handlers that can be set externally (like from socket.io)
let globalMessageHandler = null;
let globalQRHandler = null;

const setGlobalMessageHandler = (handler) => { globalMessageHandler = handler; };
const setGlobalQRHandler = (handler) => { globalQRHandler = handler; };

const startSession = async (channelId, sessionId, tenantId) => {
  if (sessions.has(channelId)) {
    return sessions.get(channelId);
  }

  const dir = path.join(sessionPath, sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(dir);

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['CRM Plugin', 'Chrome', '1.0.0'],
  });

  sessions.set(channelId, sock);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && globalQRHandler) {
      // Send QR to the specific tenant's room
      globalQRHandler({ tenantId, channelId, qr });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        sessions.delete(channelId);
        startSession(channelId, sessionId, tenantId);
      } else {
        sessions.delete(channelId);
        // Clear session folder
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        // Update DB
        await Channel.updateOne({ channelId }, { status: 'disconnected', connectedNumber: null });
      }
    } else if (connection === 'open') {
      const userJid = sock.user?.wid || sock.user?.id || '';
      await Channel.updateOne({ channelId }, { 
        status: 'connected', 
        connectedNumber: userJid.split(':')[0] 
      });
      // Try sync contacts (using the new channel-aware logic later)
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !globalMessageHandler) return;
    for (const msg of messages) {
      await globalMessageHandler({ tenantId, channelId, msg });
    }
  });

  return sock;
};

const stopSession = async (channelId) => {
  const sock = sessions.get(channelId);
  if (sock) {
    await sock.logout();
    sessions.delete(channelId);
  }
};

const getSession = (channelId) => {
  return sessions.get(channelId);
};

const isSessionConnected = (channelId) => {
  const sock = sessions.get(channelId);
  return !!(sock && sock.user);
};

const sendMessage = async (channelId, jid, content, options = {}) => {
  const sock = sessions.get(channelId);
  if (!sock || !sock.user) throw new Error('WhatsApp not connected for this channel');

  const messageOptions = {};
  if (options.quotedMessageId) messageOptions.quoted = options.quotedMessageId;
  if (options.caption && ['image', 'video', 'document'].includes(options.type)) {
    messageOptions.caption = options.caption;
  }

  try {
    const result = await sock.sendMessage(jid, { text: content }, messageOptions);
    return { success: true, messageId: result?.key?.id, timestamp: new Date() };
  } catch (error) {
    console.error(`Error sending message on channel ${channelId}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  startSession,
  stopSession,
  getSession,
  isSessionConnected,
  sendMessage,
  setGlobalMessageHandler,
  setGlobalQRHandler,
};
