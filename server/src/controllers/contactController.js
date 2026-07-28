const Contact = require('../models/Contact');
const ChatMessage = require('../models/ChatMessage');

const getChatList = async (tenantId) => {
  const contacts = await Contact.find({ tenantId }, 'jid name phone pushName isGroup channelId lastMessage lastMessageTime isOnline unreadCount profilePicUrl')
    .sort({ lastMessageTime: -1 })
    .limit(100);

  return contacts.map(contact => ({
    jid: contact.jid,
    name: contact.name || contact.pushName || contact.phone,
    phone: contact.phone,
    isGroup: contact.isGroup,
    channelId: contact.channelId,
    isOnline: contact.isOnline,
    lastMessage: contact.lastMessage,
    lastMessageTime: contact.lastMessageTime,
    unreadCount: contact.unreadCount,
    profilePicUrl: contact.profilePicUrl,
  }));
};

const getContacts = async (tenantId) => {
  return await Contact.find({ tenantId, isGroup: false }, 'jid name phone pushName isBusiness isOnline channelId about profilePicUrl lastSeen tags')
    .sort({ name: 1 })
    .limit(500);
};

const getGroups = async (tenantId) => {
  return await Contact.find({ tenantId, isGroup: true }, 'jid name subject participantCount profilePicUrl lastMessage lastMessageTime')
    .sort({ lastMessageTime: -1 });
};

const syncContacts = async (sock, store, tenantId, channelId) => {
  if (!sock) throw new Error('WhatsApp socket not connected');

  let syncedCount = 0;
  let errorCount = 0;

  const upsertContact = async (filter, update) => {
    try {
      await Contact.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
      syncedCount++;
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key - try a plain update without upsert
        try {
          await Contact.updateOne(filter, update);
          syncedCount++;
        } catch (e) {
          errorCount++;
        }
      } else {
        errorCount++;
      }
    }
  };

  // 1. Fetch groups via Baileys API
  const groups = await sock.groupFetchAllParticipating().catch((e) => {
    console.error('[Sync] groupFetchAllParticipating failed:', e.message);
    return {};
  });
  console.log(`[Sync] Found ${Object.keys(groups).length} groups`);
  for (const [jid, group] of Object.entries(groups)) {
    await upsertContact(
      { tenantId, jid },
      {
        tenantId,
        channelId,
        jid,
        name: group.subject || group.name || '',
        pushName: group.subject || '',
        isGroup: true,
        participants: group.participants?.map(p => p.id) || [],
        participantCount: group.participants?.length || 0,
        profilePicUrl: group.profilePicUrl || '',
      }
    );
  }

  // 2. Sync chats from the in-memory store (people you've messaged)
  if (store && store.chats) {
    const chatList = typeof store.chats.toJSON === 'function'
      ? Object.values(store.chats.toJSON())
      : Array.from(store.chats.values());
    console.log(`[Sync] Store has ${chatList.length} chats`);

    for (const chat of chatList) {
      const jid = chat.id;
      if (!jid) continue;
      if (jid.includes('@g.us')) continue;

      const phone = jid.split('@')[0].split(':')[0];
      const name = chat.name || chat.subject || '';
      const lastMessage = chat.lastMessage?.message?.conversation ||
                          chat.lastMessage?.message?.extendedTextMessage?.text || '';

      await upsertContact(
        { tenantId, jid },
        {
          tenantId,
          channelId,
          jid,
          phone,
          name,
          pushName: name,
          ...(lastMessage && { lastMessage }),
          ...(chat.lastMessage?.messageTimestamp && {
            lastMessageTime: new Date(chat.lastMessage.messageTimestamp * 1000)
          }),
        }
      );
    }
  } else {
    console.log('[Sync] No store or store.chats available');
  }

  // 3. Sync contacts from sock.contacts if available
  if (sock.contacts) {
    const contactsMap = sock.contacts instanceof Map
      ? Array.from(sock.contacts.entries())
      : Object.entries(sock.contacts);
    console.log(`[Sync] sock.contacts has ${contactsMap.length} entries`);

    for (const [jid, contact] of contactsMap) {
      if (!jid || jid.includes('@g.us')) continue;
      const phone = jid.split('@')[0].split(':')[0];
      await upsertContact(
        { tenantId, jid },
        {
          tenantId,
          channelId,
          jid,
          phone,
          name: contact.name || contact.notify || '',
          pushName: contact.notify || contact.name || '',
          isBusiness: contact.isBusiness || false,
          profilePicUrl: contact.imgUrl || '',
        }
      );
    }
  } else {
    console.log('[Sync] sock.contacts not available');
  }

  console.log(`[Sync] Synced ${syncedCount} contacts/groups (${errorCount} errors) for tenant ${tenantId}, channel ${channelId}`);
  return { synced: syncedCount, errors: errorCount };
};

const createOrUpdateContact = async (data) => {
  return await Contact.findOneAndUpdate(
    { $or: [{ jid: data.jid }, { phone: data.phone }] },
    data,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const addContactTag = async (jid, tag) => {
  return await Contact.findOneAndUpdate(
    { jid },
    { $addToSet: { tags: tag } },
    { new: true }
  );
};

const updateContactNotes = async (jid, notes) => {
  return await Contact.findOneAndUpdate(
    { jid },
    { notes },
    { new: true }
  );
};

const searchContacts = async (query, tenantId) => {
  const regex = new RegExp(query, 'i');
  return await Contact.find({
    tenantId,
    $or: [
      { name: regex },
      { phone: regex },
      { pushName: regex },
      { businessName: regex },
    ]
  }).limit(50);
};

module.exports = {
  getChatList,
  getContacts,
  getGroups,
  syncContacts,
  createOrUpdateContact,
  addContactTag,
  updateContactNotes,
  searchContacts,
};
