const ChatMessage = require('../models/ChatMessage');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const { updateConversationFromMessage } = require('./conversationController');

const getMessages = async (remoteJid, limit = 50, before, tenantId, channelId) => {
  const query = {
    remoteJid,
    tenantId,
    channelId,
  };

  if (before) {
    query.timestamp = {
      $lt: new Date(before),
    };
  }

  const messages = await ChatMessage.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);

  return messages.reverse();
};

const getMessagesForTenant = async (
  tenantId,
  remoteJid,
  limit = 50,
  before,
  channelId
) => {
  if (!tenantId || !remoteJid || !channelId) {
    throw new Error('tenantId, remoteJid and channelId are required');
  }

  const query = {
    tenantId,
    channelId,
    remoteJid,
  };

  if (before) {
    query.timestamp = {
      $lt: new Date(before),
    };
  }

  const messages = await ChatMessage.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);

  return messages.reverse();
};

const saveMessage = async (data) => {
  if (
    !data?.tenantId ||
    !data?.channelId ||
    !data?.remoteJid ||
    !data?.messageId
  ) {
    throw new Error(
      'tenantId, channelId, remoteJid and messageId are required'
    );
  }

  const filter = {
    tenantId: data.tenantId,
    channelId: data.channelId,
    messageId: data.messageId,
  };

  const existing = await ChatMessage.findOne(filter);

  if (existing) {
    return {
      message: existing,
      created: false,
    };
  }

  let saved;

  try {
    saved = await ChatMessage.create(data);
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await ChatMessage.findOne(filter);

      if (duplicate) {
        return {
          message: duplicate,
          created: false,
        };
      }
    }

    throw error;
  }

  const contactUpdate = {
    tenantId: data.tenantId,
    channelId: data.channelId,
    jid: data.remoteJid,
    lastMessage:
      data.content ||
      data.caption ||
      '',
    lastMessageTime:
      data.timestamp ||
      new Date(),
  };

  if (!data.fromMe) {
    contactUpdate.$inc = {
      unreadCount: 1,
    };
  }

  await Contact.findOneAndUpdate(
    {
      tenantId: data.tenantId,
      channelId: data.channelId,
      jid: data.remoteJid,
    },
    contactUpdate,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  await updateConversationFromMessage({
    tenantId: data.tenantId,
    channelId: data.channelId,
    remoteJid: data.remoteJid,
    content:
      data.content ||
      data.caption ||
      '',
    timestamp:
      data.timestamp ||
      new Date(),
    fromMe: Boolean(data.fromMe),
  });

  return {
    message: saved,
    created: true,
  };
};

const markAsRead = async (
  tenantId,
  remoteJid,
  channelId
) => {
  if (!tenantId || !remoteJid || !channelId) {
    return;
  }

  await ChatMessage.updateMany(
    {
      tenantId,
      channelId,
      remoteJid,
      read: false,
    },
    {
      $set: {
        read: true,
        updatedAt: new Date(),
      },
    }
  );

  await Contact.findOneAndUpdate(
    {
      tenantId,
      channelId,
      jid: remoteJid,
    },
    {
      $set: {
        unreadCount: 0,
      },
    }
  );

  await Conversation.findOneAndUpdate(
    {
      tenantId,
      channelId,
      contactJid: remoteJid,
    },
    {
      $set: {
        unreadCount: 0,
      },
    }
  );
};

const getUnreadCount = async (
  tenantId,
  remoteJid,
  channelId
) => {
  const query = {
    tenantId,
    remoteJid,
    read: false,
  };

  if (channelId) query.channelId = channelId;

  return ChatMessage.countDocuments(query);
};

const deleteMessage = async (messageId) => {
  return ChatMessage.findByIdAndDelete(messageId);
};

module.exports = {
  getMessages,
  getMessagesForTenant,
  saveMessage,
  markAsRead,
  getUnreadCount,
  deleteMessage,
};
