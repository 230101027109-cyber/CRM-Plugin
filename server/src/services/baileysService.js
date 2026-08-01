const { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const Channel = require('../models/Channel');

const sessions = new Map(); // Map to store multiple socket instances by channelId
const stores = new Map(); // Map to store in-memory stores by channelId
const qrs = new Map(); // Store latest QR codes by channelId
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
  const { version } = await fetchLatestBaileysVersion();

  // In-memory store to track chats/contacts for sync
  const store = makeInMemoryStore({ logger: P({ level: 'error' }).child({ level: 'error' }) });
  stores.set(channelId, store);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'error' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    defaultQueryTimeoutMs: undefined,
  });

  // Bind store to socket events so contacts/chats populate
  store.bind(sock.ev);

  sessions.set(channelId, sock);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log(`[Baileys] Channel ${channelId} update: connection=${connection}, hasQR=${!!qr}`);

    if (qr) {
      qrs.set(channelId, qr);
      if (globalQRHandler) {
        console.log(`[Baileys] Emitting QR for channel ${channelId}`);
        // Send QR to the specific tenant's room
        globalQRHandler({ tenantId, channelId, qr });
      }
    }

    if (connection === 'close') {
      qrs.delete(channelId);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[Baileys] Connection closed. Status code: ${statusCode}. Error:`, lastDisconnect?.error);
      console.log(`[Baileys] Should reconnect: ${shouldReconnect}`);
      
      try {
        if (shouldReconnect) {
          sessions.delete(channelId);
          stores.delete(channelId);
          setTimeout(() => {
            startSession(channelId, sessionId, tenantId);
          }, 2000);
        } else {
          sessions.delete(channelId);
          stores.delete(channelId);
          // Clear session folder
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
          // Update DB
          await Channel.updateOne({ channelId }, { status: 'disconnected', connectedNumber: null });
        }
      } catch (err) {
        console.error(`[Baileys] Error handling close for channel ${channelId}:`, err.message);
      }
    } else if (connection === 'open') {
      qrs.delete(channelId);
      console.log(`[Baileys] Connection OPEN for channel ${channelId}`);
      try {
        const userJid = sock.user?.wid || sock.user?.id || '';
        await Channel.updateOne({ channelId }, { 
          status: 'connected', 
          connectedNumber: userJid.split(':')[0] 
        });
        console.log(`[Baileys] Channel ${channelId} status updated to 'connected' in DB`);
      } catch (err) {
        console.error(`[Baileys] Failed to update channel ${channelId} status in DB:`, err.message);
      }
      // Contacts sync is triggered manually via the Sync button in the UI
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
    console.log(`[Baileys] History set: ${chats.length} chats, ${contacts.length} contacts, ${messages?.length || 0} messages, isLatest=${isLatest}`);

    // Persist history too. Without this, contact sync succeeds but the CRM
    // chat window is empty until a brand-new message arrives.
    if (globalMessageHandler && Array.isArray(messages)) {
      for (const msg of messages) {
        await globalMessageHandler({ tenantId, channelId, msg });
      }
    }

    // Auto-sync contacts to DB when full history is loaded
    if (isLatest && chats.length > 0) {
      try {
        const { syncContacts } = require('../controllers/contactController');
        const store = stores.get(channelId);
        const result = await syncContacts(sock, store, tenantId, channelId);
        console.log(`[Baileys] Auto-synced after history: ${JSON.stringify(result)}`);
      } catch (err) {
        console.error('[Baileys] Auto-sync after history failed:', err.message);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!['notify', 'append'].includes(type) || !globalMessageHandler) return;
    for (const msg of messages) {
      try {
        await globalMessageHandler({ tenantId, channelId, msg });
      } catch (error) {
        console.error(`[Baileys] Failed to handle ${type} message for ${channelId}:`, error.message);
      }
    }
  });

  return sock;
};

const stopSession = async (channelId) => {
  const sock = sessions.get(channelId);
  if (sock) {
    await sock.logout();
    sessions.delete(channelId);
    stores.delete(channelId);
    qrs.delete(channelId);
  }
};

const getSession = (channelId) => {
  return sessions.get(channelId);
};

const getStore = (channelId) => {
  return stores.get(channelId);
};

const isSessionConnected = (channelId) => {
  const sock = sessions.get(channelId);
  return !!(sock && sock.user);
};

const getQR = (channelId) => {
  return qrs.get(channelId) || null;
};

const sendMessage = async (channelId, jid, content, options = {}) => {
  const sock = sessions.get(channelId);
  if (!sock || !sock.user) return { success: false, error: 'WhatsApp not connected for this channel' };

  const messageOptions = {};
  if (options.quotedMessageId) messageOptions.quoted = options.quotedMessageId;
  if (options.caption && ['image', 'video', 'document'].includes(options.type)) {
    messageOptions.caption = options.caption;
  }

  try {
    const result = await sock.sendMessage(jid, { text: content }, messageOptions);
    return { success: true, messageId: result?.key?.id, timestamp: new Date() };
  } catch (error) {
    console.error(`Error sending message on channel ${channelId}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  startSession,
  stopSession,
  getSession,
  getStore,
  isSessionConnected,
  getQR,
  sendMessage,
  setGlobalMessageHandler,
  setGlobalQRHandler,
};
