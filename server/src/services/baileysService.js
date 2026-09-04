const { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const Channel = require('../models/Channel');

const sessions = new Map(); // Map to store multiple socket instances by channelId
const stores = new Map(); // Map to store in-memory stores by channelId
const qrs = new Map(); // Store latest QR codes by channelId
const sessionHandlers = new Map(); // Handlers per channel
const jidAliases = new Map(); // Map<channelId, Map<lidJid, phoneJid>>
const retryCounts = new Map(); // Map to track reconnect attempts per channelId
const MAX_RETRY_ATTEMPTS = 5;

const sessionPath = path.resolve(process.env.STORE_PATH || path.join(__dirname, '../../data/baileys'));

if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

// Handlers that can be set externally (like from socket.io)
let globalMessageHandler = null;
let globalQRHandler = null;
let globalLidMappingHandler = null;

const setGlobalMessageHandler = (handler) => { globalMessageHandler = handler; };
const setGlobalQRHandler = (handler) => { globalQRHandler = handler; };
const setGlobalLidMappingHandler = (handler) => { globalLidMappingHandler = handler; };

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
  jidAliases.set(channelId, new Map());

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'error' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    defaultQueryTimeoutMs: undefined,
    // This CRM intentionally imports contacts only on the explicit Sync
    // action. Never request or process WhatsApp message history.
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
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
        const attempts = retryCounts.get(channelId) || 0;
        if (shouldReconnect && attempts < MAX_RETRY_ATTEMPTS) {
          retryCounts.set(channelId, attempts + 1);
          const backoffDelay = Math.min(Math.pow(2, attempts) * 1000, 30000);
          console.log(`[Baileys] Reconnecting channel ${channelId} in ${backoffDelay}ms (Attempt ${attempts + 1}/${MAX_RETRY_ATTEMPTS})`);

          sessions.delete(channelId);
          stores.delete(channelId);
          jidAliases.delete(channelId);
          setTimeout(() => {
            startSession(channelId, sessionId, tenantId);
          }, backoffDelay);
        } else {
          if (attempts >= MAX_RETRY_ATTEMPTS) {
            console.error(`[Baileys] Max reconnect attempts reached for channel ${channelId}. Stopping retries.`);
          }
          retryCounts.delete(channelId);
          sessions.delete(channelId);
          stores.delete(channelId);
          jidAliases.delete(channelId);
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
      retryCounts.delete(channelId);
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

  // WhatsApp can send incoming messages using a private @lid JID even when
  // the user is already known by phone number. Consolidate both identities.
  sock.ev.on('chats.phoneNumberShare', async ({ lid, jid }) => {
    if (!lid || !jid) return;
    jidAliases.get(channelId)?.set(lid, jid);
    console.log(`[Baileys] Linked WhatsApp LID ${lid} to ${jid} on channel ${channelId}`);
    try {
      const { mergeContactIdentity } = require('../controllers/contactController');
      await mergeContactIdentity({ tenantId, channelId, lid, jid });
    } catch (error) {
      console.error(`[Baileys] Could not merge LID ${lid}:`, error.message);
    }

    if (globalLidMappingHandler) {
      try {
        await globalLidMappingHandler({ tenantId, channelId, lid, jid });
      } catch (error) {
        console.error(`[Baileys] Could not replay messages for LID ${lid}:`, error.message);
      }
    }
  });

  sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
    // Bind the data to Baileys' in-memory store so the explicit contact-sync
    // action can read contacts. Historical messages/chats are intentionally
    // never imported into CRM storage.
    console.log(`[Baileys] History received for contact sync only: ${chats.length} chats, ${contacts.length} contacts, ${messages?.length || 0} messages, isLatest=${isLatest}`);
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // `append` can be historical backfill. Persist only live notifications.
    if (type !== 'notify' || !globalMessageHandler) return;
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
    jidAliases.delete(channelId);
    qrs.delete(channelId);
  }
};

const getSession = (channelId) => {
  return sessions.get(channelId);
}

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

const getCanonicalJid = (channelId, jid) => {
  return jidAliases.get(channelId)?.get(jid) || jid;
};

const sendMessage = async (channelId, jid, content, options = {}) => {
  const sock = sessions.get(channelId);
  if (!sock || !sock.user) {
    return {
      success: false,
      error: 'WhatsApp not connected for this channel',
    };
  }

  const targetJid = getCanonicalJid(channelId, jid);

  if (!targetJid) {
    return {
      success: false,
      error: 'Could not resolve WhatsApp contact to a canonical JID',
    };
  }

  const messageOptions = {};
  if (options.quotedMessageId) {
    messageOptions.quoted = options.quotedMessageId;
  }
  if (options.caption && ['image', 'video', 'document'].includes(options.type)) {
    messageOptions.caption = options.caption;
  }

  try {
    const result = await sock.sendMessage(
      targetJid,
      { text: content },
      messageOptions
    );

    return {
      success: true,
      messageId: result?.key?.id,
      timestamp: new Date(),
      remoteJid: targetJid,
    };
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
  getCanonicalJid,
  sendMessage,
  setGlobalMessageHandler,
  setGlobalQRHandler,
  setGlobalLidMappingHandler
}
