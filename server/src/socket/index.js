const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const {
  setGlobalMessageHandler,
  setGlobalQRHandler,
  setGlobalLidMappingHandler,
  getCanonicalJid,
} = require('../services/baileysService');
const {
  saveMessage,
  markAsRead,
} = require('../controllers/messageController');
const Contact = require('../models/Contact');
const {
  buildConversationKey,
} = require('../utils/conversationKey');

const initSocket = (server) => {
  // Messages may arrive just before Baileys announces the LID -> phone JID
  // mapping. Keep them briefly in memory and replay them once resolved.
  const pendingLidMessages = new Map();
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000');

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  const authenticateSocket = (token) => {
    if (!token || !process.env.JWT_SECRET) return null;
    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      return jwt.verify(cleanToken, process.env.JWT_SECRET);
    } catch {
      return null;
    }
  };

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;
    const user = authenticateSocket(token);

    if (!user) {
      return next(new Error('Authentication error: Invalid or missing token'));
    }

    socket.user = user;
    next();
  });

  const handleWhatsAppMessage = async ({
      tenantId,
      channelId,
      msg,
    }) => {
      if (!msg?.key) return;

      const {
        remoteJid: rawRemoteJid,
        id,
      } = msg.key;

      if (!rawRemoteJid) return;

      let remoteJid =
        getCanonicalJid(
          channelId,
          String(rawRemoteJid)
        );

      // Server restart protection: reload the alias from MongoDB, scoped by
      // tenant + channel so another channel can never claim the same LID.
      if (remoteJid.endsWith('@lid')) {
        const knownContact =
          await Contact.findOne({
            tenantId,
            channelId,
            aliases: remoteJid,
          }).select('jid');

        if (knownContact?.jid) {
          remoteJid = knownContact.jid;
        }
      }

      // A private WhatsApp LID is not a usable CRM identity. Do not create
      // contacts/messages under it; wait until Baileys supplies the phone-JID
      // mapping through chats.phoneNumberShare.
      if (remoteJid.endsWith('@lid')) {
        const key = `${channelId}::${remoteJid}`;
        const pending = pendingLidMessages.get(key) || [];
        pending.push({ tenantId, channelId, msg });
        pendingLidMessages.set(key, pending.slice(-20));
        setTimeout(() => pendingLidMessages.delete(key), 60 * 1000);
        console.log(`[Socket] Queued LID message while waiting for phone mapping on channel ${channelId}`);
        return;
      }

      const fromMe =
        msg.key.fromMe === true;

      const actualSender =
        msg.key?.participant ||
        msg.key?.remoteJid ||
        '';

      const timestamp =
        msg.messageTimestamp
          ? new Date(
              Number(
                msg.messageTimestamp
              ) * 1000
            )
          : new Date();

      if (
        !remoteJid ||
        remoteJid ===
          'status@broadcast' ||
        msg.message
          ?.protocolMessage ||
        msg.message
          ?.senderKeyDistributionMessage
      ) {
        return;
      }

      const messageContent =
        msg.message
          ?.conversation ||
        msg.message
          ?.extendedTextMessage
          ?.text ||
        msg.message
          ?.imageMessage
          ?.caption ||
        msg.message
          ?.videoMessage
          ?.caption ||
        msg.message
          ?.documentMessage
          ?.caption ||
        '';

      const messageType =
        msg.message
          ?.imageMessage
          ? 'image'
          : msg.message
              ?.videoMessage
            ? 'video'
            : msg.message
                ?.audioMessage
              ? 'audio'
              : msg.message
                  ?.documentMessage
                ? 'document'
                : msg.message
                    ?.stickerMessage
                  ? 'sticker'
                  : 'text';

      try {
        const result =
          await saveMessage({
            messageId:
              id || uuid.v4(),
            tenantId,
            channelId,
            remoteJid: String(
              remoteJid
            ),
            senderJid: String(
              actualSender
            ),
            content:
              messageContent,
            messageType,
            fromMe,
            timestamp,
            participants: [
              String(
                msg.key?.participant ||
                  remoteJid
              ),
            ],
          });

        const saved =
          result.message;

        const conversationKey =
          buildConversationKey(
            channelId,
            String(remoteJid)
          );

        io.to(
          `tenant:${tenantId}`
        ).emit(
          'new_message',
          {
            remoteJid: String(
              remoteJid
            ),
            channelId,
            conversationKey,
            message: saved,
          }
        );

        const {
          processEvent,
        } = require('../services/workflowEngine');

        if (!fromMe && result.created) {
          const contact =
            await Contact.findOne({
              tenantId,
              channelId,
              jid: String(
                remoteJid
              ),
            }).select('_id');

          await processEvent(
            tenantId,
            'message_received',
            {
              tenantId,
              channelId,
              remoteJid: String(
                remoteJid
              ),
              contactId:
                contact?._id ||
                null,
              message:
                messageContent,
              isFirstMessage:
                !contact,
            }
          );
        }
      } catch (error) {
        console.error(
          `[Socket] Could not persist message ${id || 'unknown'}:`,
          error.message
        );
      }
    };

  setGlobalMessageHandler(handleWhatsAppMessage);

  setGlobalLidMappingHandler(async ({ tenantId, channelId, lid, jid }) => {
    const key = `${channelId}::${lid}`;
    const pending = pendingLidMessages.get(key) || [];
    pendingLidMessages.delete(key);

    for (const item of pending) {
      // getCanonicalJid now resolves the original LID to this phone JID.
      await handleWhatsAppMessage(item);
    }

    if (pending.length) {
      console.log(`[Socket] Replayed ${pending.length} LID message(s) for ${jid}`);
    }
  });

  setGlobalQRHandler(
    async ({
      tenantId,
      channelId,
      qr,
    }) => {
      io.to(
        `tenant:${tenantId}`
      ).emit('qr_code', qr);
    }
  );

  io.on(
    'connection',
    async (socket) => {
      const tenantId =
        socket.user.tenantId;

      console.log(
        `Client connected: ${socket.id}, Tenant: ${tenantId}`
      );

      socket.join(
        `tenant:${tenantId}`
      );

      socket.on(
        'join_chat',
        async ({
          jid,
          channelId,
        } = {}) => {
          if (!jid || !channelId) {
            return;
          }

          const canonicalJid =
            getCanonicalJid(
              channelId,
              jid
            );

          const conversationKey =
            buildConversationKey(
              channelId,
              canonicalJid
            );

          await markAsRead(
            tenantId,
            canonicalJid,
            channelId
          );

          socket.join(
            `chat:${conversationKey}`
          );

          socket.emit(
            'messages_marked_read',
            {
              jid: canonicalJid,
              channelId,
              conversationKey,
            }
          );
        }
      );

      socket.on(
        'leave_chat',
        ({
          jid,
          channelId,
        } = {}) => {
          if (!jid || !channelId) {
            return;
          }

          const canonicalJid =
            getCanonicalJid(
              channelId,
              jid
            );

          socket.leave(
            `chat:${buildConversationKey(
              channelId,
              canonicalJid
            )}`
          );
        }
      );

      socket.on(
        'disconnect',
        async () => {
          console.log(
            `Client disconnected: ${socket.id}`
          );
        }
      );
    }
  );

  return io;
};

module.exports = initSocket;
