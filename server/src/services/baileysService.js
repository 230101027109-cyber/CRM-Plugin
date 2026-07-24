const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const uuid = require('uuid');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

let sock = null;
let currentUserJid = null;
let qrCodeHandler = null;
let connectionStatusHandler = null;
let messageHandler = null;
let groupHandler = null;
let contactUpdateHandler = null;
let callsUpdateHandler = null;
const sessionPath = path.resolve(process.env.STORE_PATH || path.join(__dirname, '../../data/baileys'));
const sessionId = process.env.WHATSAPP_SESSION_ID || 'default';

if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

const startWhatsApp = async () => {
  const authResult = await useMultiFileAuthState(path.join(sessionPath, sessionId));
  const authState = authResult.state;
  const { saveCreds } = authResult;

  sock = makeWASocket({
    auth: authState,
    logger: P({ level: 'silent' }),
    browser: ['CRM Plugin', 'Chrome', '1.0.0'],
    getMessage: async (key) => {
      if (messageHandler) await messageHandler(key);
      return null;
    },
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && qrCodeHandler) {
      await qrCodeHandler(qr);
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect && sessionId) {
        await startWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('WhatsApp connected successfully');
      currentUserJid = sock.user?.wid || sock.user?.id || '';

      sock.ev.on('contacts.update', (updates) => {
        if (contactUpdateHandler) contactUpdateHandler(updates);
      });
    } else if (connection === 'connecting') {
      console.log('Connecting to WhatsApp...');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !messageHandler) return;
    for (const msg of messages) {
      await messageHandler(msg);
    }
  });

  sock.ev.on('groups.update', async (updates) => {
    if (groupHandler) await groupHandler(updates);
  });

  sock.ev.on('contacts.update', async (updates) => {
    if (contactUpdateHandler) await contactUpdateHandler(updates);
  });

  return sock;
};

const getSocket = () => sock;

const isConnected = () => !!(sock && sock.user);

const setQRHandler = (handler) => {
  qrCodeHandler = handler;
};

const setConnectionStatusHandler = (handler) => {
  connectionStatusHandler = handler;
};

const setMessageHandler = (handler) => {
  messageHandler = handler;
};

const setGroupHandler = (handler) => {
  groupHandler = handler;
};

const setContactUpdateHandler = (handler) => {
  contactUpdateHandler = handler;
};

const setCallsUpdateHandler = (handler) => {
  callsUpdateHandler = handler;
};

const sendMessage = async (jid, content, options = {}) => {
  if (!sock || !sock.user) throw new Error('WhatsApp not connected');

  const messageOptions = {};
  if (options.quotedMessageId) {
    messageOptions.quoted = options.quotedMessageId;
  }

  if (options.caption && ['image', 'video', 'document'].includes(options.type)) {
    messageOptions.caption = options.caption;
  }

  try {
    const mediaService = require('./mediaService.js');
    if (options.file && options.type) {
      return await mediaService.sendMediaMessage(sock, jid, options);
    }

    const result = await sock.sendMessage(jid, { text: content }, messageOptions);
    return { success: true, messageId: result?.key?.id, timestamp: new Date() };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
};

const getCurrentUserJid = () => currentUserJid;

const getProfilePicture = async (jid) => {
  if (!sock || !sock.user) throw new Error('WhatsApp not connected');
  try {
    const profilePic = await sock.profilePictureUrl(jid, 'image');
    return profilePic;
  } catch (error) {
    return null;
  }
};

module.exports = {
  startWhatsApp,
  getSocket,
  isConnected,
  setQRHandler,
  setConnectionStatusHandler,
  setMessageHandler,
  setGroupHandler,
  setContactUpdateHandler,
  setCallsUpdateHandler,
  sendMessage,
  getCurrentUserJid,
  getProfilePicture,
};
