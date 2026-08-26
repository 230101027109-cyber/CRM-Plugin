const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const {
  setGlobalMessageHandler,
  setGlobalQRHandler,
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
  const io = new Server(server, {
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? false
          : 'http://localhost:3000',
      credentials: true,
    },
  });

  const authenticateSocket = (
    token
  ) => {
    try {
      return jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch {
      return null;
    }
  };

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token;

    const user =
      authenticateSocket(token);

    if (!user) {
      return next(
        new Error(
          'Authentication error'
        )
      );
    }

    socket.user = user;
    next();
  });

  setGlobalMessageHandler(
    async ({
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
    }
  );

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
