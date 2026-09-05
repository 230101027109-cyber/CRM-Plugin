import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  WASocket,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import P from 'pino';
import fs from 'fs';
import path from 'path';
import { Channel } from '../../domain/models';
import { QREventPayload, LidMappingPayload, BaileysEventHandlerPayload } from '../../shared/types';
import { MAX_RETRY_ATTEMPTS, BACKOFF_MULTIPLIER, MAX_BACKOFF_DELAY, STORE_PATH } from '../../shared/constants';

interface SessionInfo {
  socket: WASocket;
  store: ReturnType<typeof makeInMemoryStore>;
  jidAliases: Map<string, string>;
  retryCount: number;
}

const sessions = new Map<string, SessionInfo>();
const qrs = new Map<string, string>();

// Handler callbacks
type MessageHandler = (payload: BaileysEventHandlerPayload) => Promise<void>;
type QRHandler = (payload: QREventPayload) => void;
type LidMappingHandler = (payload: LidMappingPayload) => Promise<void>;

let globalMessageHandler: MessageHandler | null = null;
let globalQRHandler: QRHandler | null = null;
let globalLidMappingHandler: LidMappingHandler | null = null;

export const setGlobalMessageHandler = (handler: MessageHandler): void => {
  globalMessageHandler = handler;
};

export const setGlobalQRHandler = (handler: QRHandler): void => {
  globalQRHandler = handler;
};

export const setGlobalLidMappingHandler = (handler: LidMappingHandler): void => {
  globalLidMappingHandler = handler;
};

export const startSession = async (channelId: string, sessionId: string, tenantId: string): Promise<WASocket> => {
  if (sessions.has(channelId)) {
    return sessions.get(channelId)!.socket;
  }

  const sessionDir = path.join(STORE_PATH, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const store = makeInMemoryStore({ logger: P({ level: 'error' }) });
  const jidAliases = new Map<string, string>();

  const sock: WASocket = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'error' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    defaultQueryTimeoutMs: undefined,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
  });

  store.bind(sock.ev);

  const sessionInfo: SessionInfo = {
    socket: sock,
    store,
    jidAliases,
    retryCount: 0,
  };

  sessions.set(channelId, sessionInfo);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrs.set(channelId, qr);
      if (globalQRHandler) {
        globalQRHandler({ tenantId, channelId, qr });
      }
    }

    if (connection === 'close') {
      qrs.delete(channelId);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect && sessionInfo.retryCount < MAX_RETRY_ATTEMPTS) {
        sessionInfo.retryCount++;
        const backoffDelay = Math.min(
          Math.pow(2, sessionInfo.retryCount) * BACKOFF_MULTIPLIER,
          MAX_BACKOFF_DELAY
        );

        sessions.delete(channelId);
        setTimeout(() => {
          startSession(channelId, sessionId, tenantId).catch(console.error);
        }, backoffDelay);
      } else {
        sessions.delete(channelId);
        qrs.delete(channelId);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        await Channel.updateOne({ channelId }, { status: 'disconnected', connectedNumber: null });
      }
    } else if (connection === 'open') {
      qrs.delete(channelId);
      sessionInfo.retryCount = 0;
      const userJid = sock.user?.wid || sock.user?.id || '';
      await Channel.updateOne({ channelId }, {
        status: 'connected',
        connectedNumber: userJid.split(':')[0]
      });
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('chats.phoneNumberShare', async ({ lid, jid }) => {
    if (!lid || !jid) return;
    jidAliases.set(lid, jid);

    if (globalLidMappingHandler) {
      await globalLidMappingHandler({ tenantId, channelId, lid, jid });
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !globalMessageHandler) return;

    for (const msg of messages) {
      try {
        await globalMessageHandler({ tenantId, channelId, msg });
      } catch (error) {
        console.error(`Failed to handle message for channel ${channelId}:`, error);
      }
    }
  });

  return sock;
};

export const stopSession = async (channelId: string): Promise<void> => {
  const session = sessions.get(channelId);
  if (session) {
    await session.socket.logout();
    sessions.delete(channelId);
    qrs.delete(channelId);
  }
};

export const getSession = (channelId: string): WASocket | undefined => {
  return sessions.get(channelId)?.socket;
};

export const getStore = (channelId: string) => {
  return sessions.get(channelId)?.store;
};

export const isSessionConnected = (channelId: string): boolean => {
  const session = sessions.get(channelId);
  return !!(session && session.socket.user);
};

export const getQR = (channelId: string): string | null => {
  return qrs.get(channelId) || null;
};

export const getCanonicalJid = (channelId: string, jid: string): string => {
  return sessions.get(channelId)?.jidAliases.get(jid) || jid;
};

export const sendMessage = async (
  channelId: string,
  jid: string,
  content: string,
  options?: { caption?: string; quotedMessageId?: string; type?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const session = sessions.get(channelId);
  if (!session || !session.socket.user) {
    return { success: false, error: 'WhatsApp not connected for this channel' };
  }

  const targetJid = getCanonicalJid(channelId, jid);
  if (!targetJid) {
    return { success: false, error: 'Could not resolve WhatsApp contact JID' };
  }

  try {
    const result = await session.socket.sendMessage(targetJid, { text: content });
    return {
      success: true,
      messageId: result?.key?.id,
      timestamp: new Date(),
      remoteJid: targetJid,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
